const { MongoClient } = require("mongodb");
const uri = "mongodb+srv://ddssssp:0000@cluster0.apdjqre.mongodb.net/board";

module.exports = function (callback) {
  return MongoClient.connect(uri, callback);
};
