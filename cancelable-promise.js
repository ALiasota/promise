class CancelablePromise {
  constructor(executor, parent = null) {
    if (typeof executor !== "function") {
      throw new TypeError("Executor must be function");
    }
    this.state = "pending";
    this.value = null;
    this.reason = null;
    this.onFulfilledCallbacks = [];
    this.onRejectedCallbacks = [];
    this.isCanceled = false;
    this.children = parent ? parent.children : [];
    const resolve = (value) => {
      if (this.isCanceled) {
        return;
      }
      if (this.state === "pending") {
        this.state = "fulfilled";
        this.value = value;
        this.onFulfilledCallbacks.forEach((callback) => callback(value));
        this.onFulfilledCallbacks = [];
      }
    };
    const reject = (reason) => {
      if (this.isCanceled) {
        return;
      }
      if (this.state === "pending") {
        this.state = "rejected";
        this.reason = reason;
        this.onRejectedCallbacks.forEach((callback) => callback(reason));
        this.onRejectedCallbacks = [];
      }
    };
    try {
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  }
  then(onFulfilled, onRejected) {
    if (onFulfilled && typeof onFulfilled !== "function") {
      throw new TypeError("onFulfilled must be function or undefined");
    }
    if (onRejected && typeof onRejected !== "function") {
      throw new TypeError("onRejected must be function or undefined");
    }
    onFulfilled =
      typeof onFulfilled === "function" ? onFulfilled : (value) => value;
    onRejected =
      typeof onRejected === "function"
        ? onRejected
        : (reason) => {
            throw reason;
          };
    const child = new CancelablePromise((resolve, reject) => {
      if (this.isCanceled) {
        reject({ isCanceled: true });
        return;
      }
      const processCallback = (callback, value) => {
        try {
          const x = callback(value);
          if (x instanceof CancelablePromise) {
            x.then(resolve, reject);
          } else {
            resolve(x);
          }
        } catch (error) {
          reject(error);
        }
      };
      if (this.state === "fulfilled") {
        setTimeout(
          () => processCallback(onFulfilled || ((v) => v), this.value),
          0
        );
      } else if (this.state === "rejected") {
        setTimeout(
          () =>
            processCallback(
              onRejected ||
                ((e) => {
                  throw e;
                }),
              this.reason
            ),
          0
        );
      } else {
        this.onFulfilledCallbacks.push((value) => {
          processCallback(onFulfilled || ((v) => v), value);
        });
        this.onRejectedCallbacks.push((reason) => {
          processCallback(
            onRejected ||
              ((e) => {
                throw e;
              }),
            reason
          );
        });
      }
    }, this);
    this.children.push(child);
    return child;
  }
  catch(onRejected) {
    return this.then(null, onRejected);
  }
  cancel() {
    if (!this.isCanceled) {
      this.isCanceled = true;
      this.onRejectedCallbacks.forEach((callback) => {
        callback({ isCanceled: true });
      });
      this.onFulfilledCallbacks = [];
      this.onRejectedCallbacks = [];
      this.children.forEach((child) => child.cancel());
    }
  }
}
module.exports = CancelablePromise;