function assert(obj, message) {
  if (!obj) {
    throw new Error(message);
  }
}

module.exports = assert;
