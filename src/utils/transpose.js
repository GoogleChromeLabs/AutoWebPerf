function transpose(mat) {
  if (!mat) return null;

  for (var i = 0; i < mat.length; i++) {
    for (var j = 0; j < i; j++) {
      const tmp = mat[i][j];
      mat[i][j] = mat[j][i];
      mat[j][i] = tmp;
    }
  }
}

module.exports = transpose;
