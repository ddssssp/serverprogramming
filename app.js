const express = require("express");
const { ObjectId } = require("mongodb");
const handlebars = require("express-handlebars");
const session = require("express-session");
const bcrypt = require("bcrypt");
const mongodbConnection = require("./configs/mongodb-connection");
const postService = require("./services/post-service");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));

app.engine(
  "handlebars",
  handlebars.create({
    helpers: require("./configs/handlebars-helpers"),
  }).engine
);
app.set("view engine", "handlebars");
app.set("views", __dirname + "/views");

// MongoDB 연결
let collection, usersCollection;
app.listen(3000, async () => {
  console.log("Server started");
  const mongoClient = await mongodbConnection();
  collection = mongoClient.db().collection("post");
  usersCollection = mongoClient.db().collection("users");
  console.log("MongoDB connected");
});

// 회원가입 페이지 렌더링
app.get("/register", (req, res) => {
  res.render("register", { title: "회원가입" });
});

// 회원가입 처리
app.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await usersCollection.insertOne({ username, password: hashedPassword });

  // 사용자 정보를 세션에 저장
  req.session.userId = result.insertedId;
  req.session.username = username;

  // 게시글 목록 페이지로 리디렉션
  res.redirect("/");
});

// 로그인 페이지 렌더링
app.use('/img', express.static('img'));
app.get("/login", (req, res) => {
  res.render("login", { title: "로그인" });
});

// 로그인 처리
app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await usersCollection.findOne({ username });

  if (user && await bcrypt.compare(password, user.password)) {
    req.session.userId = user._id;
    req.session.username = user.username;
    res.redirect("/");
  } else {
    res.redirect("/login");
  }
});

// 로그아웃 처리
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.redirect("/login");
});

// 인증 미들웨어
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  } else {
    res.redirect("/login");
  }
}

// 게시글 목록 페이지
app.get("/", isAuthenticated, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const search = req.query.search || "";
  try {
    const [posts, paginator] = await postService.list(collection, page, search);
    res.render("home", { title: "스터디룸", search, paginator, posts, user: { username: req.session.username } });
  } catch (error) {
    console.error(error);
    res.render("home", { title: "스터디룸" });
  }
});

// 글쓰기 페이지
app.get("/write", isAuthenticated, (req, res) => {
  res.render("write", { title: "스터디룸", mode: "create", user: { username: req.session.username } });
});

// 글쓰기 처리
app.post("/write", isAuthenticated, async (req, res) => {
  const post = req.body;
  const result = await postService.writePost(collection, post);
  res.redirect(`/detail/${result.insertedId}`);
});

// 게시글 상세 페이지
app.get("/detail/:id", isAuthenticated, async (req, res) => {
  const result = await postService.getDetailPost(collection, req.params.id);
  res.render("detail", {
    title: "스터디룸",
    post: result.value,
    user: {
      id: req.session.userId,
      username: req.session.username
    }
});
});

// 비밀번호 확인 API
app.post("/check-password", isAuthenticated, async (req, res) => {
  const { id, password } = req.body;
  const post = await postService.getPostByIdAndPassword(collection, { id, password });

  if (!post) {
    return res.status(404).json({ isExist: false });
  } else {
    return res.json({ isExist: true });
  }
});

// 수정 페이지
app.get("/modify/:id", isAuthenticated, async (req, res) => {
  const post = await postService.getPostById(collection, req.params.id);
  res.render("write", { title: "스터디룸", mode: "modify", post, user: { username: req.session.username } });
});

// 게시글 수정 페이지
app.get("/modify/:id", isAuthenticated, async (req, res) => {
  try {
    const post = await postService.getPostById(collection, req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (post.writer.toString() !== req.session.username.toString()) {
      return res.status(403).json({ error: 'You are not authorized to modify this post' });
    }
    res.render("write", { title: "스터디룸", mode: "modify", post, user: { id: req.session.userId, username: req.session.username } });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Invalid request' });
  }
});

// 게시글 수정 처리
app.post("/modify", isAuthenticated, async (req, res) => {
  try {
    const { id, title, content } = req.body;
    const post = await postService.getPostById(collection, id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (post.writer.toString() !== req.session.username.toString()) {
      return res.status(403).json({ error: 'You are not authorized to modify this post' });
    }
    await postService.updatePost(collection, id, { title, content, modifiedDt: new Date().toISOString() });
    res.redirect(`/detail/${id}`);
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Invalid request' });
  }
});

// 게시글 삭제
app.delete("/delete", isAuthenticated, async (req, res) => {
  try {
    const { id } = req.body;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid ObjectId' });
    }
    const post = await postService.getPostById(collection, id);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }
    if (post.writer.toString() !== req.session.username.toString()) {
      return res.status(403).json({ error: 'You are not authorized to delete this comment' });
    }
    await collection.deleteOne({ _id: ObjectId(id) });
    res.json({ isSuccess: true });
  } catch (error) {
    console.error(error);
    res.json({ isSuccess: false });
  }
});


// 댓글 추가
app.post("/write-comment", isAuthenticated, async (req, res) => {
  const name = req.session.username
  const {id, comment} = req.body;
  const post = await postService.getPostById(collection, id);
  // 게시글에 기존 댓글 리스트가 있으면 추가
  if (post.comments) {
    post.comments.push({
      idx: post.comments.length + 1,
      name,
      comment,
      createdDt: new Date().toISOString(),
    });
  } else {
    // 게시글에 댓글 정보가 없으면 리스트에 댓글 정보 추가
    post.comments = [
      {
        idx: 1,
        name,
        comment,
        createdDt: new Date().toISOString(),
      },
    ];
  }

  // 업데이트하기. 업데이트 후에는 상세페이지로 다시 리다이렉트
  postService.updatePost(collection, id, post);
  return res.redirect(`/detail/${id}`);
});

// 댓글 삭제
app.delete("/delete-comment", isAuthenticated, async (req, res) => {
  try {
    const { id, idx } = req.body;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid ObjectId' });
    }

    const post = await collection.findOne({ _id: ObjectId(id), "comments.idx": parseInt(idx) }, postService.projectionOption);
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const comment = post.comments.find(comment => comment.idx === parseInt(idx));
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }
    if (comment.name.toString() !== req.session.username.toString()) {
      return res.status(403).json({ error: 'You are not authorized to delete this comment' });
    }

    post.comments = post.comments.filter(comment => comment.idx !== parseInt(idx));
    await postService.updatePost(collection, id, post);
    res.json({ isSuccess: true });
  } catch (error) {
    console.error(error);
    res.json({ isSuccess: false });
  }
});