import { DeveloperError, defined, getTimestamp } from "@cesium/core";
import JobType from "./JobType.js";

/**
 *
 * @private
 * @constructor
 */
function JobTypeBudget(total) {
  /**
   * 一帧中允许使用的总预算，以毫秒为单位
   */
  this._total = total;

  /**
   * 当前此帧中已使用的时间，以毫秒为单位
   */
  this.usedThisFrame = 0.0;

  /**
   * 其他作业类型在此帧中占用的时间，以毫秒为单位
   */
  this.stolenFromMeThisFrame = 0.0;

  /**
   * 指示此作业类型在此帧中是否被限制，即该作业
   * 试图运行但没有预算
   */
  this.starvedThisFrame = false;

  /**
   * 指示此作业在上一帧中是否被限制。这防止了
   * 从此帧中被其他作业占用
   */
  this.starvedLastFrame = false;
}

Object.defineProperties(JobTypeBudget.prototype, {
  total: {
    get: function () {
      return this._total;
    },
  },
});

/**
 * 用于在帧期间对时间切片作业进行分片，以在多个帧中分摊工作。这支持：
 * <ul>
 *   <li>
 * 为不同作业类型设置独立预算，例如纹理、着色器程序和缓冲区创建。这
 * 使所有作业类型能够在每一帧中取得进展
 *   </li>
 *   <li>
 * 如果其他作业类型的预算在上一帧中未耗尽，则从它们的预算中占用资源。这允许
 * 在每一帧中为所有作业类型使用全部预算，即使所有作业都是同一类型也是如此
 *   </li>
 *   <li>
 * 确保所有作业类型在每一帧中都能取得进展，即使这意味着超过该帧的总预算
 * 这防止了例如多个昂贵的纹理上传在多个帧中影响着色器编译的情况
 *   </li>
 * </ul>
 *
 * @private
 */
function JobScheduler(budgets) {
  //>>includeStart('debug', pragmas.debug);
  if (defined(budgets) && budgets.length !== JobType.NUMBER_OF_JOB_TYPES) {
    throw new DeveloperError(
      "A budget must be specified for each job type; budgets.length should equal JobType.NUMBER_OF_JOB_TYPES.",
    );
  }
  //>>includeEnd('debug');

  // Total for defaults is half of of one frame at 10 fps
  const jobBudgets = new Array(JobType.NUMBER_OF_JOB_TYPES);
  jobBudgets[JobType.TEXTURE] = new JobTypeBudget(
    defined(budgets) ? budgets[JobType.TEXTURE] : 10.0,
  );
  // On cache miss, this most likely only allows one shader compile per frame
  jobBudgets[JobType.PROGRAM] = new JobTypeBudget(
    defined(budgets) ? budgets[JobType.PROGRAM] : 10.0,
  );
  jobBudgets[JobType.BUFFER] = new JobTypeBudget(
    defined(budgets) ? budgets[JobType.BUFFER] : 30.0,
  );

  const length = jobBudgets.length;
  let i;

  let totalBudget = 0.0;
  for (i = 0; i < length; ++i) {
    totalBudget += jobBudgets[i].total;
  }

  const executedThisFrame = new Array(length);
  for (i = 0; i < length; ++i) {
    executedThisFrame[i] = false;
  }

  this._totalBudget = totalBudget;
  this._totalUsedThisFrame = 0.0;
  this._budgets = jobBudgets;
  this._executedThisFrame = executedThisFrame;
}

// For unit testing
JobScheduler.getTimestamp = getTimestamp;

Object.defineProperties(JobScheduler.prototype, {
  totalBudget: {
    get: function () {
      return this._totalBudget;
    },
  },
});

JobScheduler.prototype.disableThisFrame = function () {
  // Prevent jobs from running this frame
  this._totalUsedThisFrame = this._totalBudget;
};

JobScheduler.prototype.resetBudgets = function () {
  const budgets = this._budgets;
  const length = budgets.length;
  for (let i = 0; i < length; ++i) {
    const budget = budgets[i];
    budget.starvedLastFrame = budget.starvedThisFrame;
    budget.starvedThisFrame = false;
    budget.usedThisFrame = 0.0;
    budget.stolenFromMeThisFrame = 0.0;
  }
  this._totalUsedThisFrame = 0.0;
};

JobScheduler.prototype.execute = function (job, jobType) {
  const budgets = this._budgets;
  const budget = budgets[jobType];

  // This ensures each job type makes progress each frame by executing at least once
  const progressThisFrame = this._executedThisFrame[jobType];

  if (this._totalUsedThisFrame >= this._totalBudget && progressThisFrame) {
    // No budget left this frame for jobs of any type
    budget.starvedThisFrame = true;
    return false;
  }

  let stolenBudget;

  if (budget.usedThisFrame + budget.stolenFromMeThisFrame >= budget.total) {
    // No budget remaining for jobs of this type. Try to steal from other job types.
    const length = budgets.length;
    let i;
    for (i = 0; i < length; ++i) {
      stolenBudget = budgets[i];

      // Steal from this budget if it has time left and it wasn't starved last fame
      if (
        stolenBudget.usedThisFrame + stolenBudget.stolenFromMeThisFrame <
          stolenBudget.total &&
        !stolenBudget.starvedLastFrame
      ) {
        break;
      }
    }

    if (i === length && progressThisFrame) {
      // No other job types can give up their budget this frame, and
      // this job type already progressed this frame
      return false;
    }

    if (progressThisFrame) {
      // It is considered "starved" even if it executes using stolen time so that
      // next frame, no other job types can steal time from it.
      budget.starvedThisFrame = true;
    }
  }

  const startTime = JobScheduler.getTimestamp();
  job.execute();
  const duration = JobScheduler.getTimestamp() - startTime;

  // Track both time remaining for this job type and all jobs
  // so budget stealing does send us way over the total budget.
  this._totalUsedThisFrame += duration;

  if (stolenBudget) {
    stolenBudget.stolenFromMeThisFrame += duration;
  } else {
    budget.usedThisFrame += duration;
  }
  this._executedThisFrame[jobType] = true;

  return true;
};
export default JobScheduler;
