module.exports = {
  // ❶ 리스트 길이를 반환
  lengthOfList: (list = []) => list.length,
  // ❷ 두 값을 비교해 같은지 유무를 반환
  eq: (val1, val2) => val1 === val2,
  // ❸ ISO 날짜 문자열에서 날짜만 반환
  dateString: (isoString) => new Date(isoString).toLocaleDateString(),
};
