const lodash = require("lodash"); // ❶
const PAGE_LIST_SIZE = 10; // ❷

module.exports = ({ totalCount, page, perPage = 10 }) => {
  // ❸
  const PER_PAGE = perPage;
  const totalPage = Math.ceil(totalCount / PER_PAGE); // ❹

  // 시작 페이지 : 몫 * PAGE_LIST_SIZE + 1
  let quotient = parseInt(page / PAGE_LIST_SIZE);
  if (page % PAGE_LIST_SIZE === 0) {
    quotient -= 1;
  }
  const startPage = quotient * PAGE_LIST_SIZE + 1; // ❺

  // 끝 페이지 : startPage + PAGE_LIST_SIZE - 1
  const endPage =
    startPage + PAGE_LIST_SIZE - 1 < totalPage
      ? startPage + PAGE_LIST_SIZE - 1
      : totalPage; // ❻
  const isFirstPage = page === 1;
  const isLastPage = page === totalPage;
  const hasPrev = page > 1;
  const hasNext = page < totalPage;

  const paginator = {
    pageList: lodash.range(startPage, endPage + 1), // ❼
    page,
    prevPage: page - 1,
    nextPage: page + 1,
    startPage,
    lastPage: totalPage,
    hasPrev,
    hasNext,
    isFirstPage,
    isLastPage,
  };
  return paginator;
};
