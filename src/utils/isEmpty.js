module.exports = isEmpty = (obj) =>
  (typeof obj === "string" && obj === "") ||
  obj === undefined ||
  obj === null ||
  (typeof obj === "object" && Object.keys(obj).length === 0) ||
  (typeof obj === "object" && obj.length === 0);
