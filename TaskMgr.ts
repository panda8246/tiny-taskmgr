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
 * 工作队列管理
 */
export class TaskMgr {
  private _nextId: number = 1;
  private _running: boolean = false;
  /** 取消任务集合支持cancel取消任务 */
  private _taskCancelSet: Set<number> = new Set();

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
    const id = this._nextId++;
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
      return true;
    }
    return false;
  }

  /**
   * 处理异步任务
   * @param task 任务
   * @returns void
   */
  handleAsyncTask(task: TaskInfo, promise: Promise<any>): void {
    const shouldWait = task.donotWaitAsync !== true;

    promise
      .then(
        (result) => {
          if (!this.checkAndClearCanceled(task.id)) {
            task.resolve?.(result);
          }
          if (shouldWait) this._step();
        },
        (reason) => {
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

  handleFunctionTask(task: TaskInfo): void {
    let isAsync = false;
    try {
      const result = task.task();
      if (result instanceof Promise) {
        isAsync = true;
        this.handleAsyncTask(task, result);
        return;
      }
      task.resolve?.(result);
    } catch (error) {
      if (task.catch) {
        task.catch(error);
      } else {
        console.error(
          `[TaskMgr] 未捕获的同步任务异常 [${task.taskDesc}]:`,
          error
        );
      }
    } finally {
      if (!isAsync) {
        this._step();
      }
    }
  }

  public clear(): void {
    this._tasks.length = 0;
    this._taskCancelSet.clear();
    this._running = false;
  }
}
