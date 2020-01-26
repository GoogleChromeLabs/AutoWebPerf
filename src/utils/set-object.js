function setObject(obj, path, value) {
  if (!path) return;

  let properties = path.split('.');
  let len = properties.length;
  for (let i = 0; i < len - 1; i++) {
    let elem = properties[i];
    obj[elem] = obj[elem] || {};
    obj = obj[elem];
  }
  obj[properties[len - 1]] = value;
}

module.exports = setObject;
