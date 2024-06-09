const paginator = require("../utils/paginator");
const { ObjectId } = require("mongodb");

async function writePost(collection, post) {
  post.hits = 0;
  post.createdDt = new Date().toISOString();
  return await collection.insertOne(post);
}

async function list(collection, page, search) {
  const perPage = 10;
  const query = { title: new RegExp(search, "i") };
  const cursor = collection
    .find(query, { limit: perPage, skip: (page - 1) * perPage })
    .sort({
      createdDt: -1,
    });
  const totalCount = await collection.count(query);
  const posts = await cursor.toArray();
  const paginatorObj = paginator({ totalCount, page, perPage: perPage });
  return [posts, paginatorObj];
}

const projectionOption = {
  projection: {
    // 프로젝션(투영) 결괏값에서 일부만 가져올 때 사용
    password: 0,
    "comments.password": 0,
  },
};

async function getDetailPost(collection, id) {
  return await collection.findOneAndUpdate(
    { _id: ObjectId(id) },
    { $inc: { hits: 1 } },
    projectionOption
  );
}

async function getPostByIdAndPassword(collection, { id, password }) {
  //  ❶ findOne() 함수 사용
  return await collection.findOne(
    { _id: ObjectId(id), password: password },
    projectionOption
  );
}

// ❷ id로 데이터 불러오기
async function getPostById(collection, id) {
  return await collection.findOne({ _id: ObjectId(id) }, projectionOption);
}

// ❸ 게시글 수정
async function updatePost(collection, id, post) {
  const toUpdatePost = {
    $set: {
      ...post,
    },
  };
  return await collection.updateOne({ _id: ObjectId(id) }, toUpdatePost);
}

// 양파 랭킹 시스템
async function getPraiseRanking(collection) {
  const pipeline = [
    { $match: { category: 'praise' } },
    { $group: { _id: '$writer', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ];
  const result = await collection.aggregate(pipeline).toArray();
  return result;
}

async function getBlameRanking(collection) {
  const pipeline = [
    { $match: { category: 'blame' } },
    { $group: { _id: '$writer', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ];
  const result = await collection.aggregate(pipeline).toArray();
  return result;
}

module.exports = {
  list,
  writePost,
  getDetailPost,
  getPostById,
  getPostByIdAndPassword,
  updatePost,
  getPraiseRanking,
  getBlameRanking,
};
