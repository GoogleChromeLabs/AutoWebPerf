function transpose(a) {
  return a[0].map(function (_, c) { return a.map(function (r) { return r[c]; }); });
}

module.exports = transpose;
