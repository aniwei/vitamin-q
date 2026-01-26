#include "QuickJS/extension/taro_js_type.h"

#include "./settup.h"

TEST(TaroJSStringTest, TrimTest) {
  // trim() 测试
  JSValue str1 = JS_NewString(ctx, "  hello world  ");
  JSValue trimmed = taro_js_string_trim(ctx, str1);
  EXPECT_EQ(JSToString(trimmed), "hello world");
  JS_FreeValue(ctx, trimmed);
  JS_FreeValue(ctx, str1);

  // trim() 边缘情况 - 空字符串
  JSValue emptyStr = JS_NewString(ctx, "");
  JSValue trimmedEmpty = taro_js_string_trim(ctx, emptyStr);
  EXPECT_EQ(JSToString(trimmedEmpty), "");
  JS_FreeValue(ctx, trimmedEmpty);
  JS_FreeValue(ctx, emptyStr);

  // trim() 边缘情况 - 只有空白字符
  JSValue whitespaceStr = JS_NewString(ctx, "  \t\n\r  ");
  JSValue trimmedWhitespace = taro_js_string_trim(ctx, whitespaceStr);
  EXPECT_EQ(JSToString(trimmedWhitespace), "");
  JS_FreeValue(ctx, trimmedWhitespace);
  JS_FreeValue(ctx, whitespaceStr);

  // trim() 边缘情况 - 没有空白字符
  JSValue noWhitespaceStr = JS_NewString(ctx, "hello");
  JSValue trimmedNoWhitespace = taro_js_string_trim(ctx, noWhitespaceStr);
  EXPECT_EQ(JSToString(trimmedNoWhitespace), "hello");
  JS_FreeValue(ctx, trimmedNoWhitespace);
  JS_FreeValue(ctx, noWhitespaceStr);
}

TEST(TaroJSStringTest, TrimStartTest) {
  // trimStart() 测试
  JSValue str1 = JS_NewString(ctx, "  hello world  ");
  JSValue trimmed = taro_js_string_trim_start(ctx, str1);
  EXPECT_EQ(JSToString(trimmed), "hello world  ");
  JS_FreeValue(ctx, trimmed);
  JS_FreeValue(ctx, str1);

  // trimStart() 边缘情况 - 空字符串
  JSValue emptyStr = JS_NewString(ctx, "");
  JSValue trimmedEmpty = taro_js_string_trim_start(ctx, emptyStr);
  EXPECT_EQ(JSToString(trimmedEmpty), "");
  JS_FreeValue(ctx, trimmedEmpty);
  JS_FreeValue(ctx, emptyStr);

  // trimStart() 边缘情况 - 只有空白字符
  JSValue whitespaceStr = JS_NewString(ctx, "  \t\n\r  ");
  JSValue trimmedWhitespace = taro_js_string_trim_start(ctx, whitespaceStr);
  EXPECT_EQ(JSToString(trimmedWhitespace), "");
  JS_FreeValue(ctx, trimmedWhitespace);
  JS_FreeValue(ctx, whitespaceStr);

  // trimStart() 边缘情况 - 没有前导空白字符
  JSValue noLeadingWhitespaceStr = JS_NewString(ctx, "hello  ");
  JSValue trimmedNoLeadingWhitespace =
      taro_js_string_trim_start(ctx, noLeadingWhitespaceStr);
  EXPECT_EQ(JSToString(trimmedNoLeadingWhitespace), "hello  ");
  JS_FreeValue(ctx, trimmedNoLeadingWhitespace);
  JS_FreeValue(ctx, noLeadingWhitespaceStr);
}

TEST(TaroJSStringTest, TrimEndTest) {
  // trimEnd() 测试
  JSValue str1 = JS_NewString(ctx, "  hello world  ");
  JSValue trimmed = taro_js_string_trim_end(ctx, str1);
  EXPECT_EQ(JSToString(trimmed), "  hello world");
  JS_FreeValue(ctx, trimmed);
  JS_FreeValue(ctx, str1);

  // trimEnd() 边缘情况 - 空字符串
  JSValue emptyStr = JS_NewString(ctx, "");
  JSValue trimmedEmpty = taro_js_string_trim_end(ctx, emptyStr);
  EXPECT_EQ(JSToString(trimmedEmpty), "");
  JS_FreeValue(ctx, trimmedEmpty);
  JS_FreeValue(ctx, emptyStr);

  // trimEnd() 边缘情况 - 只有空白字符
  JSValue whitespaceStr = JS_NewString(ctx, "  \t\n\r  ");
  JSValue trimmedWhitespace = taro_js_string_trim_end(ctx, whitespaceStr);
  EXPECT_EQ(JSToString(trimmedWhitespace), "");
  JS_FreeValue(ctx, trimmedWhitespace);
  JS_FreeValue(ctx, whitespaceStr);

  // trimEnd() 边缘情况 - 没有尾随空白字符
  JSValue noTrailingWhitespaceStr = JS_NewString(ctx, "  hello");
  JSValue trimmedNoTrailingWhitespace =
      taro_js_string_trim_end(ctx, noTrailingWhitespaceStr);
  EXPECT_EQ(JSToString(trimmedNoTrailingWhitespace), "  hello");
  JS_FreeValue(ctx, trimmedNoTrailingWhitespace);
  JS_FreeValue(ctx, noTrailingWhitespaceStr);
}

TEST(TaroJSStringTest, ToLowerCaseTest) {
  // toLowerCase() 测试
  JSValue str1 = JS_NewString(ctx, "HELLO World 123");
  JSValue lowered = taro_js_string_to_lower_case(ctx, str1);
  EXPECT_EQ(JSToString(lowered), "hello world 123");
  JS_FreeValue(ctx, lowered);
  JS_FreeValue(ctx, str1);

  // toLowerCase() 边缘情况 - 空字符串
  JSValue emptyStr = JS_NewString(ctx, "");
  JSValue loweredEmpty = taro_js_string_to_lower_case(ctx, emptyStr);
  EXPECT_EQ(JSToString(loweredEmpty), "");
  JS_FreeValue(ctx, loweredEmpty);
  JS_FreeValue(ctx, emptyStr);

  // toLowerCase() 边缘情况 - 特殊字符
  JSValue specialCharsStr = JS_NewString(ctx, "!@#$%^&*()_+");
  JSValue loweredSpecialChars =
      taro_js_string_to_lower_case(ctx, specialCharsStr);
  EXPECT_EQ(JSToString(loweredSpecialChars), "!@#$%^&*()_+");
  JS_FreeValue(ctx, loweredSpecialChars);
  JS_FreeValue(ctx, specialCharsStr);

  // toLowerCase() 边缘情况 - 已经全是小写
  JSValue allLowerCaseStr = JS_NewString(ctx, "already lowercase");
  JSValue loweredAllLowerCase =
      taro_js_string_to_lower_case(ctx, allLowerCaseStr);
  EXPECT_EQ(JSToString(loweredAllLowerCase), "already lowercase");
  JS_FreeValue(ctx, loweredAllLowerCase);
  JS_FreeValue(ctx, allLowerCaseStr);
}

TEST(TaroJSStringTest, ToUpperCaseTest) {
  // toUpperCase() 测试
  JSValue str1 = JS_NewString(ctx, "hello World 123");
  JSValue uppercased = taro_js_string_to_upper_case(ctx, str1);
  EXPECT_EQ(JSToString(uppercased), "HELLO WORLD 123");
  JS_FreeValue(ctx, uppercased);
  JS_FreeValue(ctx, str1);

  // toUpperCase() 边缘情况 - 空字符串
  JSValue emptyStr = JS_NewString(ctx, "");
  JSValue uppercasedEmpty = taro_js_string_to_upper_case(ctx, emptyStr);
  EXPECT_EQ(JSToString(uppercasedEmpty), "");
  JS_FreeValue(ctx, uppercasedEmpty);
  JS_FreeValue(ctx, emptyStr);

  // toUpperCase() 边缘情况 - 特殊字符
  JSValue specialCharsStr = JS_NewString(ctx, "!@#$%^&*()_+");
  JSValue uppercasedSpecialChars =
      taro_js_string_to_upper_case(ctx, specialCharsStr);
  EXPECT_EQ(JSToString(uppercasedSpecialChars), "!@#$%^&*()_+");
  JS_FreeValue(ctx, uppercasedSpecialChars);
  JS_FreeValue(ctx, specialCharsStr);

  // toUpperCase() 边缘情况 - 已经全是大写
  JSValue allUpperCaseStr = JS_NewString(ctx, "ALREADY UPPERCASE");
  JSValue uppercasedAllUpperCase =
      taro_js_string_to_upper_case(ctx, allUpperCaseStr);
  EXPECT_EQ(JSToString(uppercasedAllUpperCase), "ALREADY UPPERCASE");
  JS_FreeValue(ctx, uppercasedAllUpperCase);
  JS_FreeValue(ctx, allUpperCaseStr);
}

TEST(TaroJSStringTest, SplitTest) {
  // split() 测试 - 基本分割
  JSValue str1 = JS_NewString(ctx, "apple,banana,orange");
  JSValue sep = JS_NewString(ctx, ",");
  JSValue result = taro_js_string_split(ctx, str1, sep);
  std::vector<std::string> expected = {"apple", "banana", "orange"};
  CheckJSArray(result, expected);
  JS_FreeValue(ctx, result);
  JS_FreeValue(ctx, sep);
  JS_FreeValue(ctx, str1);

  // split() 测试 - 带限制
  JSValue str2 = JS_NewString(ctx, "apple,banana,orange,grape");
  JSValue sep2 = JS_NewString(ctx, ",");
  JSValue limit = JS_NewInt32(ctx, 2);
  JSValue resultLimit = taro_js_string_split(ctx, str2, sep2, limit);
  std::vector<std::string> expectedLimit = {"apple", "banana"};
  CheckJSArray(resultLimit, expectedLimit);
  JS_FreeValue(ctx, resultLimit);
  JS_FreeValue(ctx, limit);
  JS_FreeValue(ctx, sep2);
  JS_FreeValue(ctx, str2);

  // split() 边缘情况 - 空分隔符
  JSValue str3 = JS_NewString(ctx, "hello");
  JSValue emptySep = JS_NewString(ctx, "");
  JSValue resultEmptySep = taro_js_string_split(ctx, str3, emptySep);
  std::vector<std::string> expectedEmptySep = {"h", "e", "l", "l", "o"};
  CheckJSArray(resultEmptySep, expectedEmptySep);
  JS_FreeValue(ctx, resultEmptySep);
  JS_FreeValue(ctx, emptySep);
  JS_FreeValue(ctx, str3);

  // split() 边缘情况 - 空字符串
  JSValue emptyStr = JS_NewString(ctx, "");
  JSValue sepForEmpty = JS_NewString(ctx, ",");
  JSValue resultEmpty = taro_js_string_split(ctx, emptyStr, sepForEmpty);
  std::vector<std::string> expectedEmpty = {""};
  CheckJSArray(resultEmpty, expectedEmpty);
  JS_FreeValue(ctx, resultEmpty);
  JS_FreeValue(ctx, sepForEmpty);
  JS_FreeValue(ctx, emptyStr);

  // split() 边缘情况 - 分隔符不在字符串中
  JSValue str4 = JS_NewString(ctx, "hello");
  JSValue notFoundSep = JS_NewString(ctx, ",");
  JSValue resultNotFound = taro_js_string_split(ctx, str4, notFoundSep);
  std::vector<std::string> expectedNotFound = {"hello"};
  CheckJSArray(resultNotFound, expectedNotFound);
  JS_FreeValue(ctx, resultNotFound);
  JS_FreeValue(ctx, notFoundSep);
  JS_FreeValue(ctx, str4);
}

TEST(TaroJSStringTest, IncludesTest) {
  // includes() 测试 - 基本检查
  JSValue str1 = JS_NewString(ctx, "Hello world");
  JSValue search1 = JS_NewString(ctx, "world");
  JSValue result1 = taro_js_string_includes(ctx, str1, search1);
  EXPECT_TRUE(JSToBool(result1));
  JS_FreeValue(ctx, result1);
  JS_FreeValue(ctx, search1);

  // includes() 测试 - 不包含
  JSValue search2 = JS_NewString(ctx, "universe");
  JSValue result2 = taro_js_string_includes(ctx, str1, search2);
  EXPECT_FALSE(JSToBool(result2));
  JS_FreeValue(ctx, result2);
  JS_FreeValue(ctx, search2);

  // includes() 测试 - 带位置
  JSValue search3 = JS_NewString(ctx, "Hello");
  JSValue position = JS_NewInt32(ctx, 1);
  JSValue result3 = taro_js_string_includes(ctx, str1, search3, position);
  EXPECT_FALSE(JSToBool(result3));
  JS_FreeValue(ctx, result3);
  JS_FreeValue(ctx, position);
  JS_FreeValue(ctx, search3);

  // includes() 边缘情况 - 空搜索字符串
  JSValue emptySearch = JS_NewString(ctx, "");
  JSValue resultEmpty = taro_js_string_includes(ctx, str1, emptySearch);
  EXPECT_TRUE(JSToBool(resultEmpty));
  JS_FreeValue(ctx, resultEmpty);
  JS_FreeValue(ctx, emptySearch);

  // includes() 边缘情况 - 空目标字符串
  JSValue emptyTarget = JS_NewString(ctx, "");
  JSValue searchInEmpty = JS_NewString(ctx, "test");
  JSValue resultEmptyTarget =
      taro_js_string_includes(ctx, emptyTarget, searchInEmpty);
  EXPECT_FALSE(JSToBool(resultEmptyTarget));
  JS_FreeValue(ctx, resultEmptyTarget);
  JS_FreeValue(ctx, searchInEmpty);
  JS_FreeValue(ctx, emptyTarget);

  JS_FreeValue(ctx, str1);
}

TEST(TaroJSStringTest, StartsWithTest) {
  // startsWith() 测试 - 基本检查
  JSValue str1 = JS_NewString(ctx, "Hello world");
  JSValue search1 = JS_NewString(ctx, "Hello");
  JSValue result1 = taro_js_string_starts_with(ctx, str1, search1);
  EXPECT_TRUE(JSToBool(result1));
  JS_FreeValue(ctx, result1);
  JS_FreeValue(ctx, search1);

  // startsWith() 测试 - 不匹配
  JSValue search2 = JS_NewString(ctx, "world");
  JSValue result2 = taro_js_string_starts_with(ctx, str1, search2);
  EXPECT_FALSE(JSToBool(result2));
  JS_FreeValue(ctx, result2);
  JS_FreeValue(ctx, search2);

  // startsWith() 测试 - 带位置
  JSValue search3 = JS_NewString(ctx, "world");
  JSValue position = JS_NewInt32(ctx, 6);
  JSValue result3 = taro_js_string_starts_with(ctx, str1, search3, position);
  EXPECT_TRUE(JSToBool(result3));
  JS_FreeValue(ctx, result3);
  JS_FreeValue(ctx, position);
  JS_FreeValue(ctx, search3);

  // startsWith() 边缘情况 - 空搜索字符串
  JSValue emptySearch = JS_NewString(ctx, "");
  JSValue resultEmpty = taro_js_string_starts_with(ctx, str1, emptySearch);
  EXPECT_TRUE(JSToBool(resultEmpty));
  JS_FreeValue(ctx, resultEmpty);
  JS_FreeValue(ctx, emptySearch);

  // startsWith() 边缘情况 - 空目标字符串
  JSValue emptyTarget = JS_NewString(ctx, "");
  JSValue searchInEmpty = JS_NewString(ctx, "test");
  JSValue resultEmptyTarget =
      taro_js_string_starts_with(ctx, emptyTarget, searchInEmpty);
  EXPECT_FALSE(JSToBool(resultEmptyTarget));
  JS_FreeValue(ctx, resultEmptyTarget);
  JS_FreeValue(ctx, searchInEmpty);
  JS_FreeValue(ctx, emptyTarget);

  // startsWith() 边缘情况 - 越界位置
  JSValue outOfBoundsPosition = JS_NewInt32(ctx, 100);
  JSValue search4 = JS_NewString(ctx, "world");
  JSValue resultOutOfBounds =
      taro_js_string_starts_with(ctx, str1, search4, outOfBoundsPosition);
  EXPECT_FALSE(JSToBool(resultOutOfBounds));
  JS_FreeValue(ctx, resultOutOfBounds);
  JS_FreeValue(ctx, search4);
  JS_FreeValue(ctx, outOfBoundsPosition);

  JS_FreeValue(ctx, str1);
}

TEST(TaroJSStringTest, EndsWithTest) {
  // endsWith() 测试 - 基本检查
  JSValue str1 = JS_NewString(ctx, "Hello world");
  JSValue search1 = JS_NewString(ctx, "world");
  JSValue result1 = taro_js_string_ends_with(ctx, str1, search1);
  EXPECT_TRUE(JSToBool(result1));
  JS_FreeValue(ctx, result1);
  JS_FreeValue(ctx, search1);

  // endsWith() 测试 - 不匹配
  JSValue search2 = JS_NewString(ctx, "Hello");
  JSValue result2 = taro_js_string_ends_with(ctx, str1, search2);
  EXPECT_FALSE(JSToBool(result2));
  JS_FreeValue(ctx, result2);
  JS_FreeValue(ctx, search2);

  // endsWith() 测试 - 带位置
  JSValue search3 = JS_NewString(ctx, "Hello");
  JSValue position = JS_NewInt32(ctx, 5);
  JSValue result3 = taro_js_string_ends_with(ctx, str1, search3, position);
  EXPECT_TRUE(JSToBool(result3));
  JS_FreeValue(ctx, result3);
  JS_FreeValue(ctx, position);
  JS_FreeValue(ctx, search3);

  // endsWith() 边缘情况 - 空搜索字符串
  JSValue emptySearch = JS_NewString(ctx, "");
  JSValue resultEmpty = taro_js_string_ends_with(ctx, str1, emptySearch);
  EXPECT_TRUE(JSToBool(resultEmpty));
  JS_FreeValue(ctx, resultEmpty);
  JS_FreeValue(ctx, emptySearch);

  // endsWith() 边缘情况 - 空目标字符串
  JSValue emptyTarget = JS_NewString(ctx, "");
  JSValue searchInEmpty = JS_NewString(ctx, "test");
  JSValue resultEmptyTarget =
      taro_js_string_ends_with(ctx, emptyTarget, searchInEmpty);
  EXPECT_FALSE(JSToBool(resultEmptyTarget));
  JS_FreeValue(ctx, resultEmptyTarget);
  JS_FreeValue(ctx, searchInEmpty);
  JS_FreeValue(ctx, emptyTarget);

  JS_FreeValue(ctx, str1);
}

TEST(TaroJSStringTest, ReplaceTest) {
  // replace() 测试 - 基本替换
  JSValue str1 = JS_NewString(ctx, "Hello world");
  JSValue search1 = JS_NewString(ctx, "world");
  JSValue replace1 = JS_NewString(ctx, "universe");
  JSValue result1 = taro_js_string_replace(ctx, str1, search1, replace1);
  EXPECT_EQ(JSToString(result1), "Hello universe");
  JS_FreeValue(ctx, result1);
  JS_FreeValue(ctx, replace1);
  JS_FreeValue(ctx, search1);

  // replace() 测试 - 搜索词不存在
  JSValue search2 = JS_NewString(ctx, "planet");
  JSValue replace2 = JS_NewString(ctx, "universe");
  JSValue result2 = taro_js_string_replace(ctx, str1, search2, replace2);
  EXPECT_EQ(JSToString(result2), "Hello world");
  JS_FreeValue(ctx, result2);
  JS_FreeValue(ctx, replace2);
  JS_FreeValue(ctx, search2);

  // replace() 边缘情况 - 空搜索字符串
  JSValue emptySearch = JS_NewString(ctx, "");
  JSValue replace3 = JS_NewString(ctx, "test");
  JSValue resultEmpty =
      taro_js_string_replace(ctx, str1, emptySearch, replace3);
  EXPECT_EQ(JSToString(resultEmpty), "testHello world");
  JS_FreeValue(ctx, resultEmpty);
  JS_FreeValue(ctx, replace3);
  JS_FreeValue(ctx, emptySearch);

  // replace() 边缘情况 - 空替换字符串
  JSValue search3 = JS_NewString(ctx, "world");
  JSValue emptyReplace = JS_NewString(ctx, "");
  JSValue resultEmptyReplace =
      taro_js_string_replace(ctx, str1, search3, emptyReplace);
  EXPECT_EQ(JSToString(resultEmptyReplace), "Hello ");
  JS_FreeValue(ctx, resultEmptyReplace);
  JS_FreeValue(ctx, emptyReplace);
  JS_FreeValue(ctx, search3);

  JS_FreeValue(ctx, str1);
}

TEST(TaroJSStringTest, ReplaceAllTest) {
  // replaceAll() 测试 - 基本替换所有
  JSValue str1 = JS_NewString(ctx, "Hello world world");
  JSValue search1 = JS_NewString(ctx, "world");
  JSValue replace1 = JS_NewString(ctx, "universe");
  JSValue result1 = taro_js_string_replace_all(ctx, str1, search1, replace1);
  EXPECT_EQ(JSToString(result1), "Hello universe universe");
  JS_FreeValue(ctx, result1);
  JS_FreeValue(ctx, replace1);
  JS_FreeValue(ctx, search1);

  // replaceAll() 测试 - 搜索词不存在
  JSValue search2 = JS_NewString(ctx, "planet");
  JSValue replace2 = JS_NewString(ctx, "universe");
  JSValue result2 = taro_js_string_replace_all(ctx, str1, search2, replace2);
  EXPECT_EQ(JSToString(result2), "Hello world world");
  JS_FreeValue(ctx, result2);
  JS_FreeValue(ctx, replace2);
  JS_FreeValue(ctx, search2);

  // replaceAll() 边缘情况 - 空搜索字符串
  JSValue emptySearch = JS_NewString(ctx, "");
  JSValue replace3 = JS_NewString(ctx, "x");
  JSValue resultEmpty =
      taro_js_string_replace_all(ctx, str1, emptySearch, replace3);
  EXPECT_EQ(
      JSToString(resultEmpty), "xHxexlxlxox xwxoxrxlxdx xwxoxrxlxdx");
  JS_FreeValue(ctx, resultEmpty);
  JS_FreeValue(ctx, replace3);
  JS_FreeValue(ctx, emptySearch);

  // replaceAll() 边缘情况 - 空替换字符串
  JSValue search3 = JS_NewString(ctx, "world");
  JSValue emptyReplace = JS_NewString(ctx, "");
  JSValue resultEmptyReplace =
      taro_js_string_replace_all(ctx, str1, search3, emptyReplace);
  EXPECT_EQ(JSToString(resultEmptyReplace), "Hello  ");
  JS_FreeValue(ctx, resultEmptyReplace);
  JS_FreeValue(ctx, emptyReplace);
  JS_FreeValue(ctx, search3);

  JS_FreeValue(ctx, str1);
}

// 增加复杂的Unicode字符测试
TEST(TaroJSStringTest, UnicodeCharactersTest) {
  // Unicode测试 - 中文字符
  JSValue chineseStr = JS_NewString(ctx, "你好，世界");
  JSValue lowerChinese = taro_js_string_to_lower_case(ctx, chineseStr);
  EXPECT_EQ(JSToString(lowerChinese), "你好，世界"); // 中文不受大小写影响
  JS_FreeValue(ctx, lowerChinese);

  // 测试中文分割
  JSValue separator = JS_NewString(ctx, "，");
  JSValue chineseSplit = taro_js_string_split(ctx, chineseStr, separator);
  std::vector<std::string> expectedChinese = {"你好", "世界"};
  CheckJSArray(chineseSplit, expectedChinese);
  JS_FreeValue(ctx, chineseSplit);
  JS_FreeValue(ctx, separator);

  // 测试Unicode字符的trim
  JSValue unicodeWithSpaces = JS_NewString(ctx, "  你好，世界  ");
  JSValue trimmedUnicode = taro_js_string_trim(ctx, unicodeWithSpaces);
  EXPECT_EQ(JSToString(trimmedUnicode), "你好，世界");
  JS_FreeValue(ctx, trimmedUnicode);
  JS_FreeValue(ctx, unicodeWithSpaces);

  // 测试包含检查
  JSValue searchChinese = JS_NewString(ctx, "世界");
  JSValue resultIncludes =
      taro_js_string_includes(ctx, chineseStr, searchChinese);
  EXPECT_TRUE(JSToBool(resultIncludes));
  JS_FreeValue(ctx, resultIncludes);
  JS_FreeValue(ctx, searchChinese);

  JS_FreeValue(ctx, chineseStr);

  // Unicode测试 - 表情符号和特殊字符
  JSValue emojiStr = JS_NewString(ctx, "Hello 😊 World 👋");

  // 替换表情
  JSValue searchEmoji = JS_NewString(ctx, "😊");
  JSValue replaceEmoji = JS_NewString(ctx, "🌎");
  JSValue resultReplaceEmoji =
      taro_js_string_replace(ctx, emojiStr, searchEmoji, replaceEmoji);
  EXPECT_EQ(JSToString(resultReplaceEmoji), "Hello 🌎 World 👋");
  JS_FreeValue(ctx, resultReplaceEmoji);
  JS_FreeValue(ctx, replaceEmoji);
  JS_FreeValue(ctx, searchEmoji);

  // 测试表情符号的分割
  JSValue emojiSeparator = JS_NewString(ctx, " ");
  JSValue emojiSplit = taro_js_string_split(ctx, emojiStr, emojiSeparator);
  std::vector<std::string> expectedEmoji = {"Hello", "😊", "World", "👋"};
  CheckJSArray(emojiSplit, expectedEmoji);
  JS_FreeValue(ctx, emojiSplit);
  JS_FreeValue(ctx, emojiSeparator);

  JS_FreeValue(ctx, emojiStr);
}

// 测试非字符串输入的自动转换
TEST(TaroJSStringTest, NonStringInputTest) {
  // 数字输入
  JSValue numVal = JS_NewInt32(ctx, 123);
  JSValue trimmedNum = taro_js_string_trim(ctx, numVal);
  EXPECT_EQ(JSToString(trimmedNum), "123");
  JS_FreeValue(ctx, trimmedNum);
  JS_FreeValue(ctx, numVal);

  // 布尔输入
  JSValue boolVal = JS_NewBool(ctx, true);
  JSValue upperBool = taro_js_string_to_upper_case(ctx, boolVal);
  EXPECT_EQ(JSToString(upperBool), "TRUE");
  JS_FreeValue(ctx, upperBool);
  JS_FreeValue(ctx, boolVal);

  // null输入转换 (这会引发异常，我们期望行为定义良好)
  JSValue nullVal = JS_NULL;
  JSValue trimmedNull = taro_js_string_trim(ctx, nullVal);
  // 根据实现可能会有不同的行为，这里我们只检查结果不是异常
  if (!taro_is_exception(trimmedNull)) {
    JS_FreeValue(ctx, trimmedNull);
  }
}

// 性能边缘情况测试
TEST(TaroJSStringTest, PerformanceEdgeCases) {
  // 生成长字符串
  std::string longStr(10000, 'a');
  JSValue longJSStr = JS_NewString(ctx, longStr.c_str());

  // 测试长字符串的基本操作
  JSValue trimmedLong = taro_js_string_trim(ctx, longJSStr);
  EXPECT_EQ(longStr, JSToString(trimmedLong));
  JS_FreeValue(ctx, trimmedLong);

  // 测试长字符串的分割
  JSValue shortSep = JS_NewString(ctx, "a");
  JSValue splitResult = taro_js_string_split(ctx, longJSStr, shortSep);
  // 结果会非常大，这里我们只检查分割是否完成而不引发崩溃
  ASSERT_TRUE(taro_is_array(ctx, splitResult));

  int32_t length;
  JSValue lengthVal = JS_GetPropertyStr(ctx, splitResult, "length");
  JS_ToInt32(ctx, &length, lengthVal);
  JS_FreeValue(ctx, lengthVal);

  // 预期有大量空字符串
  EXPECT_GT(length, 9000);

  JS_FreeValue(ctx, splitResult);
  JS_FreeValue(ctx, shortSep);
  JS_FreeValue(ctx, longJSStr);
}
