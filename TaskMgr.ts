export interface ITask {
  /** 任务 */
  task: () => any;
  /** 任务描述 promise报错时堆栈信息丢失，强制使用方传入，便于未主动catch时定位调试 */
  taskDesc: string;
  /** 完成回调 */
  resolve?: (...args: any[]) => void;
  /** 是否等待任务 */
  donotWaitAsync?: boolean;
  /** 失败回调 */
  reject?: (reason?: any) => void;
  /** 错误回调 */
  catch?: (reason?: any) => void;
}

type TaskInfo = ITask & { id: number };

/**
 * 微型工作队列
 */
export class TaskMgr {
  private _nextId: number = 1;
  private _running: boolean = false;
  /** 正在运行的任务集合（包含异步不等待的任务） */
  private _runningTasks: Map<number, TaskInfo> = new Map();
  /** 取消任务集合支持cancel取消任务 */
  private _taskCancelSet: Set<number> = new Set();
  /** 实例ID，用于解决 clear 后旧任务回调污染问题 */
  private _sessionId: number = 0;

  /**
   * 创建工作队列管理
   * @returns TaskMgr
   */
  public static create(): TaskMgr {
    return new TaskMgr();
  }

  private _tasks: TaskInfo[] = [];

  /**
   * 添加任务
   * @param task 任务
   * @returns 任务id
   */
  public addTask(task: ITask): number {
    const id = (this._nextId++ << this._sessionId) >>> 0;
    this._tasks.push({ id, ...task });
    if (!this._running) {
      this._running = true;
      this._step();
    }
    return id;
  }

  /**
   * 取消任务
   * @param id 任务id
   */
  public cancelTask(id: number): void {
    this._taskCancelSet.add(id);
  }
  /**
   * 执行下一个任务
   */
  private _step(): void {
    const task = this._tasks.shift();
    if (!task) {
      this._running = false;
      return;
    }
    if (this.checkAndClearCanceled(task.id)) {
      this._step();
      return;
    }
    this._runningTasks.set(task.id, task);
    this.handleFunctionTask(task);
  }

  /**
   * 检查并清理已取消的任务
   * @param taskId 任务id
   * @returns true 表示任务已取消
   */
  checkAndClearCanceled(taskId: number): boolean {
    if (this._taskCancelSet.has(taskId)) {
      this._taskCancelSet.delete(taskId);
      this._runningTasks.delete(taskId);
      return true;
    }
    return false;
  }

  /**
   * 处理任务
   * @param task 任务
   * @returns void
   */
  handleFunctionTask(task: TaskInfo): void {
    let isAsync = false;
    // 捕获当前实例ID
    const currentSession = this._sessionId;

    try {
      const result = task.task();
      if (result instanceof Promise) {
        isAsync = true;
        this.handleAsyncTask(task, result, currentSession);
        return;
      }
      // 同步任务也检查实例ID（防止 task() 执行过程中触发了 clear）
      if (this._sessionId === currentSession) {
        task.resolve?.(result);
      }
    } catch (error) {
      if (this._sessionId === currentSession) {
        if (task.catch) {
          task.catch(error);
        } else {
          console.error(
            `[TaskMgr] 未捕获的同步任务异常 [${task.taskDesc}]:`,
            error
          );
        }
      }
    } finally {
      if (!isAsync && this._sessionId === currentSession) {
        // 如果实例已变更，不再处理后续逻辑（如 _step）
        this._runningTasks.delete(task.id);
        this._step();
      }
    }
  }

  /**
   * 处理异步任务
   * @param task 任务
   * @param promise 任务Promise
   * @param sessionId 任务启动时的实例ID
   * @returns void
   */
  handleAsyncTask(
    task: TaskInfo,
    promise: Promise<any>,
    sessionId: number
  ): void {
    const shouldWait = task.donotWaitAsync !== true;

    promise
      .then(
        (result) => {
          // 如果实例ID不一致，说明经历了 clear，直接丢弃回调
          if (this._sessionId !== sessionId) {
            return;
          }

          this._runningTasks.delete(task.id);
          if (!this.checkAndClearCanceled(task.id)) {
            task.resolve?.(result);
          }
          if (shouldWait) this._step();
        },
        (reason) => {
          // 如果实例ID不一致，说明经历了 clear，直接丢弃回调
          if (this._sessionId !== sessionId) {
            return;
          }

          this._runningTasks.delete(task.id);
          if (!this.checkAndClearCanceled(task.id)) {
            if (task.reject) {
              task.reject(reason);
            } else if (task.catch) {
              task.catch(reason);
            } else {
              console.error(
                `[TaskMgr] 未捕获的 Promise 错误 [${task.taskDesc}]:`,
                reason
              );
            }
          }
          if (shouldWait) this._step();
        }
      )
      .catch((reason) => {
        // 如果实例ID不一致，说明经历了 clear，直接丢弃回调
        if (this._sessionId !== sessionId) {
          return;
        }

        this._runningTasks.delete(task.id);
        if (task.catch) {
          task.catch(reason);
        } else {
          console.error(`[TaskMgr] 未捕获的异常 [${task.taskDesc}]:`, reason);
        }
        if (shouldWait) this._step();
      });

    // 无需等待的任务立即执行下一个
    if (!shouldWait) this._step();
  }

  /**
   * 判断任务是否存在
   * @param taskId 任务id
   * @returns 是否存在且未被取消
   */
  public isTaskAlive(taskId: number): boolean {
    // 如果在取消列表中，直接返回 false
    if (this._taskCancelSet.has(taskId)) {
      return false;
    }

    // 检查是否在正在运行的任务集合中
    if (this._runningTasks.has(taskId)) {
      return true;
    }

    // 检查是否在等待队列中
    return this._tasks.some((t) => t.id === taskId);
  }

  public clear(): void {
    this._sessionId++; // 自增实例ID，使旧任务的回调失效
    this._tasks.length = 0;
    this._taskCancelSet.clear();
    this._running = false;
    this._runningTasks.clear();
  }
}
