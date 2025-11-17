import { TaskMgr } from "./TaskMgr";

/**
 * TaskMgr 单元测试
 */
export class TaskMgrTest {
  private static testCount = 0;
  private static passCount = 0;
  private static failCount = 0;

  /**
   * 断言工具
   */
  private static assert(condition: boolean, message: string): void {
    this.testCount++;
    if (condition) {
      this.passCount++;
      console.log(`✅ [PASS] ${message}`);
    } else {
      this.failCount++;
      console.error(`❌ [FAIL] ${message}`);
    }
  }

  /**
   * 等待指定时间
   */
  private static wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 测试1：基本同步任务执行
   */
  static async test1_basicSync(): Promise<void> {
    console.log("\n=== 测试1：基本同步任务执行 ===");
    const mgr = TaskMgr.create();
    const results: string[] = [];

    mgr.addTask({
      taskDesc: "同步任务1",
      task: () => {
        results.push("task1");
        return "result1";
      },
      resolve: (result) => {
        results.push(result);
      },
    });

    mgr.addTask({
      taskDesc: "同步任务2",
      task: () => {
        results.push("task2");
        return "result2";
      },
      resolve: (result) => {
        results.push(result);
      },
    });

    await this.wait(100);

    this.assert(results.length === 4, "应执行2个任务和2个resolve");
    this.assert(results[0] === "task1", "任务1应先执行");
    this.assert(results[1] === "result1", "任务1的resolve应执行");
    this.assert(results[2] === "task2", "任务2应后执行");
    this.assert(results[3] === "result2", "任务2的resolve应执行");
  }

  /**
   * 测试2：基本异步任务执行
   */
  static async test2_basicAsync(): Promise<void> {
    console.log("\n=== 测试2：基本异步任务执行 ===");
    const mgr = TaskMgr.create();
    const results: string[] = [];

    mgr.addTask({
      taskDesc: "异步任务1",
      task: () =>
        new Promise((resolve) => {
          setTimeout(() => {
            results.push("task1");
            resolve("result1");
          }, 100);
        }),
      resolve: (result) => {
        results.push(result);
      },
    });

    mgr.addTask({
      taskDesc: "异步任务2",
      task: () =>
        new Promise((resolve) => {
          setTimeout(() => {
            results.push("task2");
            resolve("result2");
          }, 50);
        }),
      resolve: (result) => {
        results.push(result);
      },
    });

    await this.wait(300);

    this.assert(results.length === 4, "应执行2个任务和2个resolve");
    console.log(results);
    this.assert(results[0] === "task1", "任务1应先完成（虽然耗时更长）");
    this.assert(results[1] === "result1", "任务1的resolve应执行");
    this.assert(results[2] === "task2", "任务2应等待任务1完成后执行");
    this.assert(results[3] === "result2", "任务2的resolve应执行");
  }

  /**
   * 测试3：同步任务错误处理（有catch）
   */
  static async test3_syncErrorWithCatch(): Promise<void> {
    console.log("\n=== 测试3：同步任务错误处理（有catch）===");
    const mgr = TaskMgr.create();
    const results: string[] = [];

    mgr.addTask({
      taskDesc: "同步任务-会抛错",
      task: () => {
        results.push("task1");
        throw new Error("预期的错误");
      },
      catch: (error) => {
        results.push("caught:" + error.message);
      },
    });

    mgr.addTask({
      taskDesc: "后续任务",
      task: () => {
        results.push("task2");
      },
    });

    await this.wait(100);

    this.assert(results.length === 3, "错误被捕获，后续任务应继续");
    this.assert(results[0] === "task1", "任务1应执行");
    this.assert(results[1] === "caught:预期的错误", "catch应捕获错误");
    this.assert(results[2] === "task2", "后续任务应正常执行");
  }

  /**
   * 测试4：同步任务错误处理（无catch）
   */
  static async test4_syncErrorWithoutCatch(): Promise<void> {
    console.log("\n=== 测试4：同步任务错误处理（无catch）===");
    const mgr = TaskMgr.create();
    const results: string[] = [];

    // 临时劫持console.error来验证错误输出
    const originalError = console.error;
    let errorLogged = false;
    console.error = (...args: any[]) => {
      if (args[0]?.includes("未捕获的同步任务异常")) {
        errorLogged = true;
      }
      originalError.apply(console, args);
    };

    mgr.addTask({
      taskDesc: "同步任务-未捕获",
      task: () => {
        results.push("task1");
        throw new Error("未捕获的错误");
      },
    });

    mgr.addTask({
      taskDesc: "后续任务",
      task: () => {
        results.push("task2");
      },
    });

    await this.wait(100);

    console.error = originalError;

    this.assert(errorLogged, "应输出错误日志到console.error");
    this.assert(results.length === 2, "即使未捕获，后续任务也应执行");
    this.assert(results[1] === "task2", "后续任务应正常执行");
  }

  /**
   * 测试5：异步任务错误处理（有reject）
   */
  static async test5_asyncErrorWithReject(): Promise<void> {
    console.log("\n=== 测试5：异步任务错误处理（有reject）===");
    const mgr = TaskMgr.create();
    const results: string[] = [];

    mgr.addTask({
      taskDesc: "异步任务-Promise reject",
      task: () =>
        new Promise((resolve, reject) => {
          setTimeout(() => {
            results.push("task1");
            reject("拒绝原因");
          }, 50);
        }),
      reject: (reason) => {
        results.push("rejected:" + reason);
      },
    });

    mgr.addTask({
      taskDesc: "后续任务",
      task: () => {
        results.push("task2");
      },
    });

    await this.wait(200);

    this.assert(results.length === 3, "reject被处理，后续任务应继续");
    this.assert(results[0] === "task1", "任务1应执行");
    this.assert(results[1] === "rejected:拒绝原因", "reject应被调用");
    this.assert(results[2] === "task2", "后续任务应正常执行");
  }

  /**
   * 测试6：异步任务错误处理（有catch）
   */
  static async test6_asyncErrorWithCatch(): Promise<void> {
    console.log("\n=== 测试6：异步任务错误处理（有catch）===");
    const mgr = TaskMgr.create();
    const results: string[] = [];

    mgr.addTask({
      taskDesc: "异步任务-有catch",
      task: () => Promise.reject("错误信息"),
      catch: (reason) => {
        results.push("caught:" + reason);
      },
    });

    mgr.addTask({
      taskDesc: "后续任务",
      task: () => {
        results.push("task2");
      },
    });

    await this.wait(100);

    this.assert(results.length === 2, "catch被处理，后续任务应继续");
    this.assert(results[0] === "caught:错误信息", "catch应被调用");
    this.assert(results[1] === "task2", "后续任务应正常执行");
  }

  /**
   * 测试7：异步任务错误处理（无reject和catch）
   */
  static async test7_asyncErrorWithoutHandlers(): Promise<void> {
    console.log("\n=== 测试7：异步任务错误处理（无reject和catch）===");
    const mgr = TaskMgr.create();
    const results: string[] = [];

    // 临时劫持console.error
    const originalError = console.error;
    let errorLogged = false;
    console.error = (...args: any[]) => {
      if (args[0]?.includes("未捕获的 Promise 错误")) {
        errorLogged = true;
      }
      originalError.apply(console, args);
    };

    mgr.addTask({
      taskDesc: "异步任务-无处理",
      task: () => Promise.reject("未处理的错误"),
    });

    mgr.addTask({
      taskDesc: "后续任务",
      task: () => {
        results.push("task2");
      },
    });

    await this.wait(100);

    console.error = originalError;

    this.assert(errorLogged, "应输出错误日志到console.error");
    this.assert(results.length === 1, "后续任务应正常执行");
    this.assert(results[0] === "task2", "后续任务应正常执行");
  }

  /**
   * 测试8：取消任务
   */
  static async test8_cancelTask(): Promise<void> {
    console.log("\n=== 测试8：取消任务 ===");
    const mgr = TaskMgr.create();
    const results: string[] = [];

    // 先添加一个阻塞性的异步任务，确保后续任务仍在队列中，可以被取消
    mgr.addTask({
      taskDesc: "阻塞任务",
      task: () =>
        new Promise((resolve) => {
          setTimeout(resolve, 50);
        }),
    });

    const taskId1 = mgr.addTask({
      taskDesc: "任务1-会被取消",
      task: () => {
        results.push("task1");
      },
    });

    const taskId2 = mgr.addTask({
      taskDesc: "任务2-正常执行",
      task: () => {
        results.push("task2");
      },
    });

    const taskId3 = mgr.addTask({
      taskDesc: "任务3-会被取消",
      task: () => {
        results.push("task3");
      },
    });

    mgr.cancelTask(taskId1);
    mgr.cancelTask(taskId3);

    await this.wait(100);

    this.assert(results.length === 1, "只有任务2应执行");
    this.assert(results[0] === "task2", "任务2应正常执行");
  }

  /**
   * 测试9：取消异步任务（已开始执行）
   */
  static async test9_cancelRunningAsyncTask(): Promise<void> {
    console.log("\n=== 测试9：取消异步任务（已开始执行）===");
    const mgr = TaskMgr.create();
    const results: string[] = [];

    const taskId = mgr.addTask({
      taskDesc: "异步任务-会被取消",
      task: () =>
        new Promise((resolve) => {
          setTimeout(() => {
            results.push("task1");
            resolve("result1");
          }, 100);
        }),
      resolve: (result) => {
        results.push("resolve:" + result);
      },
    });

    // 异步任务已经开始执行，取消后resolve不应被调用
    mgr.cancelTask(taskId);

    await this.wait(200);

    this.assert(results.length === 1, "Promise会执行，但resolve不会被调用");
    this.assert(results[0] === "task1", "Promise内部逻辑会执行");
  }

  /**
   * 测试10：donotWaitAsync 并行执行
   */
  static async test10_noWaitAsync(): Promise<void> {
    console.log("\n=== 测试10：donotWaitAsync 并行执行 ===");
    const mgr = TaskMgr.create();
    const results: string[] = [];

    mgr.addTask({
      taskDesc: "异步任务1-不等待",
      task: () =>
        new Promise((resolve) => {
          setTimeout(() => {
            results.push("task1");
            resolve("result1");
          }, 200);
        }),
      donotWaitAsync: true,
      resolve: (result) => {
        results.push("resolve1:" + result);
      },
    });

    mgr.addTask({
      taskDesc: "异步任务2-不等待",
      task: () =>
        new Promise((resolve) => {
          setTimeout(() => {
            results.push("task2");
            resolve("result2");
          }, 100);
        }),
      donotWaitAsync: true,
      resolve: (result) => {
        results.push("resolve2:" + result);
      },
    });

    mgr.addTask({
      taskDesc: "同步任务3",
      task: () => {
        results.push("task3");
      },
    });

    await this.wait(50);
    this.assert(results.length === 1, "同步任务应立即执行");
    this.assert(results[0] === "task3", "同步任务不等待前面的异步任务");

    await this.wait(100);
    this.assert(results.length === 3, "任务2应先完成（耗时更短）");
    this.assert(results[1] === "task2", "任务2先完成");
    this.assert(results[2] === "resolve2:result2", "任务2的resolve执行");

    await this.wait(100);
    this.assert(results.length === 5, "任务1应最后完成");
    this.assert(results[3] === "task1", "任务1后完成");
    this.assert(results[4] === "resolve1:result1", "任务1的resolve执行");
  }

  /**
   * 测试11：清空任务队列
   */
  static async test11_clearTasks(): Promise<void> {
    console.log("\n=== 测试11：清空任务队列 ===");
    const mgr = TaskMgr.create();
    const results: string[] = [];

    // 添加一个阻塞任务，确保清空时其余任务仍在队列中
    mgr.addTask({
      taskDesc: "阻塞任务",
      task: () =>
        new Promise((resolve) => {
          setTimeout(resolve, 50);
        }),
    });

    mgr.addTask({
      taskDesc: "任务1",
      task: () => {
        results.push("task1");
      },
    });

    mgr.addTask({
      taskDesc: "任务2",
      task: () => {
        results.push("task2");
      },
    });

    mgr.addTask({
      taskDesc: "任务3",
      task: () => {
        results.push("task3");
      },
    });

    mgr.clear();

    await this.wait(100);

    this.assert(results.length === 0, "清空后所有任务都不应执行");
  }

  /**
   * 测试12：混合任务类型
   */
  static async test12_mixedTasks(): Promise<void> {
    console.log("\n=== 测试12：混合任务类型 ===");
    const mgr = TaskMgr.create();
    const results: string[] = [];

    mgr.addTask({
      taskDesc: "同步任务1",
      task: () => {
        results.push("sync1");
      },
    });

    mgr.addTask({
      taskDesc: "异步任务2",
      task: () =>
        new Promise((resolve) => {
          setTimeout(() => {
            results.push("async2");
            resolve("done");
          }, 50);
        }),
    });

    mgr.addTask({
      taskDesc: "同步任务3",
      task: () => {
        results.push("sync3");
      },
    });

    mgr.addTask({
      taskDesc: "异步任务4-不等待",
      task: () =>
        new Promise((resolve) => {
          setTimeout(() => {
            results.push("async4");
            resolve("done");
          }, 100);
        }),
      donotWaitAsync: true,
    });

    mgr.addTask({
      taskDesc: "同步任务5",
      task: () => {
        results.push("sync5");
      },
    });

    await this.wait(200);

    this.assert(results.length === 5, "所有任务应执行");
    this.assert(results[0] === "sync1", "同步任务1先执行");
    this.assert(results[1] === "async2", "异步任务2等待完成");
    this.assert(results[2] === "sync3", "同步任务3继续");
    this.assert(results[3] === "sync5", "同步任务5不等待任务4");
    this.assert(results[4] === "async4", "异步任务4最后完成");
  }

  /**
   * 测试13：resolve返回值传递
   */
  static async test13_resolveChaining(): Promise<void> {
    console.log("\n=== 测试13：resolve返回值传递 ===");
    const mgr = TaskMgr.create();
    const results: number[] = [];

    mgr.addTask({
      taskDesc: "任务1",
      task: () => 10,
      resolve: (result) => {
        results.push(result);
      },
    });

    mgr.addTask({
      taskDesc: "任务2",
      task: () => results[0] * 2,
      resolve: (result) => {
        results.push(result);
      },
    });

    mgr.addTask({
      taskDesc: "任务3",
      task: () => results[1] + 5,
      resolve: (result) => {
        results.push(result);
      },
    });

    await this.wait(100);

    this.assert(results.length === 3, "所有任务应执行");
    this.assert(results[0] === 10, "任务1返回10");
    this.assert(results[1] === 20, "任务2返回20");
    this.assert(results[2] === 25, "任务3返回25");
  }

  /**
   * 测试14：空队列状态
   */
  static async test14_emptyQueue(): Promise<void> {
    console.log("\n=== 测试14：空队列状态 ===");
    const mgr = TaskMgr.create();
    const results: string[] = [];

    mgr.addTask({
      taskDesc: "任务1",
      task: () => {
        results.push("task1");
      },
    });

    await this.wait(100);

    // 队列已空，再添加新任务应正常执行
    mgr.addTask({
      taskDesc: "任务2",
      task: () => {
        results.push("task2");
      },
    });

    await this.wait(100);

    this.assert(results.length === 2, "队列清空后添加的任务应正常执行");
    this.assert(results[0] === "task1", "任务1先执行");
    this.assert(results[1] === "task2", "任务2后执行");
  }

  /**
   * 测试15：reject和catch同时存在
   */
  static async test15_rejectAndCatchBoth(): Promise<void> {
    console.log("\n=== 测试15：reject和catch同时存在 ===");
    const mgr = TaskMgr.create();
    const results: string[] = [];

    mgr.addTask({
      taskDesc: "异步任务-同时有reject和catch",
      task: () => Promise.reject("错误"),
      reject: (reason) => {
        results.push("reject:" + reason);
      },
      catch: (reason) => {
        results.push("catch:" + reason);
      },
    });

    await this.wait(100);

    this.assert(results.length === 1, "只应调用reject");
    this.assert(results[0] === "reject:错误", "reject优先被调用");
  }

  /**
   * 运行所有测试
   */
  static async runAll(): Promise<void> {
    console.log("\n========================================");
    console.log("开始运行 TaskMgr 单元测试");
    console.log("========================================");

    this.testCount = 0;
    this.passCount = 0;
    this.failCount = 0;

    await this.test1_basicSync();
    await this.test2_basicAsync();
    await this.test3_syncErrorWithCatch();
    await this.test4_syncErrorWithoutCatch();
    await this.test5_asyncErrorWithReject();
    await this.test6_asyncErrorWithCatch();
    await this.test7_asyncErrorWithoutHandlers();
    await this.test8_cancelTask();
    await this.test9_cancelRunningAsyncTask();
    await this.test10_noWaitAsync();
    await this.test11_clearTasks();
    await this.test12_mixedTasks();
    await this.test13_resolveChaining();
    await this.test14_emptyQueue();
    await this.test15_rejectAndCatchBoth();

    console.log("\n========================================");
    console.log("测试结果汇总");
    console.log("========================================");
    console.log(`总测试数: ${this.testCount}`);
    console.log(`通过: ${this.passCount} ✅`);
    console.log(`失败: ${this.failCount} ❌`);
    console.log(
      `通过率: ${((this.passCount / this.testCount) * 100).toFixed(2)}%`
    );
    console.log("========================================\n");

    if (this.failCount === 0) {
      console.log("🎉 所有测试通过！");
    } else {
      console.error("⚠️ 部分测试失败，请检查！");
    }
  }
}

// 运行测试
// TaskMgrTest.runAll();

// 运行单个测试
// TaskMgrTest.test1_basicSync();

TaskMgrTest.runAll();
