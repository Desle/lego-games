import { createEnum } from '../../../../shared/types/enum.types.ts'
import type { TokenReaderFailure as TokenReaderFailureValue } from '../token-reader/token-reader.types.ts'

// Listed in the order of the original's message table at GolDP.dll 0x1005f260.
export const TokenReaderFailure = createEnum({
  SYNTAX_ERROR: 'syntax_error',
  NUMERIC_TOO_LONG: 'numeric_too_long',
  EXPECTED_STRING: 'expected_string',
  EXPECTED_FLOAT: 'expected_float',
  EXPECTED_INTEGER: 'expected_integer',
  EXPECTED_LEFT_CURLY: 'expected_left_curly',
  EXPECTED_RIGHT_CURLY: 'expected_right_curly',
  EXPECTED_LEFT_BRACKET: 'expected_left_bracket',
  EXPECTED_RIGHT_BRACKET: 'expected_right_bracket',
  EXPECTED_COMMA: 'expected_comma',
  EXPECTED_SEMICOLON: 'expected_semicolon',
  EXPECTED_END_OF_FILE: 'expected_end_of_file',
  EXPECTED_STRING_OR_BRACKET: 'expected_string_or_bracket',
  INVALID_KEYWORD: 'invalid_keyword',
  INVALID_STRING: 'invalid_string',
  INVALID_VALUE: 'invalid_value',
  DUPLICATE_NAME: 'duplicate_name',
  UNSUPPORTED: 'unsupported',
  UNEXPECTED_KEYWORD: 'unexpected_keyword',
  EXPECTED_KEYWORD: 'expected_keyword',
})

export const TOKEN_READER_FAILURE_MESSAGES: Readonly<Record<TokenReaderFailureValue, string>> =
  Object.freeze({
    syntax_error: 'Syntax error',
    numeric_too_long: 'Numeric too long',
    expected_string: 'Expected string',
    expected_float: 'Expected float',
    expected_integer: 'Expected int',
    expected_left_curly: 'Expected left curly',
    expected_right_curly: 'Expected right curly',
    expected_left_bracket: 'Expected left bracket',
    expected_right_bracket: 'Expected right bracket',
    expected_comma: 'Expected comma',
    expected_semicolon: 'Expected semicolon',
    expected_end_of_file: 'Expected EOF',
    expected_string_or_bracket: 'Expected string or bracket',
    invalid_keyword: 'Invalid keyword',
    invalid_string: 'Invalid string',
    invalid_value: 'Invalid value',
    duplicate_name: 'Duplicate name',
    unsupported: 'Unsupported',
    unexpected_keyword: 'Unexpected keyword',
    expected_keyword: 'Expected keyword',
  })
