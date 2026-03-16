/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "lil",

  extras: ($) => [/\s/, $.comment],

  conflicts: ($) => [[$.block, $.table_literal]],

  word: ($) => $.identifier,

  rules: {
    source_file: ($) => repeat($._statement),

    _statement: ($) =>
      choice($.let_declaration, $.type_declaration, $.assignment, $._expression),

    // --- Declarations ---

    let_declaration: ($) =>
      seq(
        "let",
        field("name", $.identifier),
        optional(seq(":", field("type", $._type_expression))),
        "=",
        field("value", choice($.enum_definition, $._expression)),
      ),

    type_declaration: ($) =>
      seq("type", field("name", $.identifier), "=", field("type", $._type_expression)),

    assignment: ($) =>
      prec.right(
        1,
        seq(field("name", $.identifier), "=", field("value", $._expression)),
      ),

    // --- Expressions ---

    _expression: ($) =>
      choice(
        $.match_expression,
        $.function_definition,
        $.continue_expression,
        $.return_expression,
        $.binary_expression,
        $.unary_expression,
        $.call_expression,
        $.index_expression,
        $.field_expression,
        $.parenthesized_expression,
        $.table_literal,
        $.array_literal,
        $._primary,
      ),

    // --- Binary expressions with precedence ---

    binary_expression: ($) =>
      choice(
        ...[
          ["==", 3],
          ["!=", 3],
          ["<", 4],
          [">", 4],
          ["<=", 4],
          [">=", 4],
          ["+", 5],
          ["-", 5],
          ["*", 6],
          ["/", 6],
          ["%", 6],
        ].map(([op, prec_val]) =>
          prec.left(
            prec_val,
            seq(
              field("left", $._expression),
              field("operator", op),
              field("right", $._expression),
            ),
          ),
        ),
      ),

    unary_expression: ($) =>
      prec(
        7,
        seq(
          field("operator", choice("-", "!")),
          field("operand", $._expression),
        ),
      ),

    // --- Postfix ---

    call_expression: ($) =>
      prec(
        8,
        seq(
          field("function", $._expression),
          "(",
          field("arguments", optional($.argument_list)),
          ")",
        ),
      ),

    argument_list: ($) => seq($._expression, repeat(seq(",", $._expression))),

    index_expression: ($) =>
      prec(
        8,
        seq(
          field("object", $._expression),
          "[",
          field("index", $._expression),
          "]",
        ),
      ),

    field_expression: ($) =>
      prec(
        8,
        seq(
          field("object", $._expression),
          ".",
          field("field", $.identifier),
        ),
      ),

    parenthesized_expression: ($) => seq("(", $._expression, ")"),

    // --- Labels ---

    label: ($) => seq(":", $.identifier),

    // --- Match ---

    match_expression: ($) =>
      seq(
        "match",
        optional(field("label", $.label)),
        field("scrutinee", $._expression),
        "{",
        optional($.match_body),
        "}",
      ),

    match_body: ($) =>
      seq($.match_arm, repeat(seq(",", $.match_arm)), optional(",")),

    match_arm: ($) =>
      seq(
        field("pattern", $._pattern),
        "=>",
        field("body", choice(prec(1, $.block), $._expression)),
      ),

    _pattern: ($) =>
      choice(
        $.enum_variant_pattern,
        $.variant_pattern,
        $.integer,
        $.float,
        $.string,
        $.true,
        $.false,
        $.nil,
        $.identifier,
      ),

    // Dotted: Color.red or Shape.circle(binding)
    enum_variant_pattern: ($) =>
      seq(
        field("enum", $.identifier),
        ".",
        field("variant", $.identifier),
        optional(seq("(", field("binding", $.identifier), ")")),
      ),

    // Direct: Value(binding) or Error(binding)
    variant_pattern: ($) =>
      seq(field("variant", $.identifier), "(", field("binding", $.identifier), ")"),

    // --- Enums ---

    enum_definition: ($) =>
      seq(
        "enum",
        "{",
        optional(
          seq($.enum_variant, repeat(seq(",", $.enum_variant)), optional(",")),
        ),
        "}",
      ),

    enum_variant: ($) =>
      seq(
        field("name", $.identifier),
        optional(seq("=", field("value", $._expression))),
      ),

    // --- Functions ---

    function_definition: ($) =>
      seq(
        "fn",
        "(",
        field("parameters", optional($.parameter_list)),
        ")",
        optional(field("error_marker", "!")),
        optional(seq("->", field("return_type", $._type_expression))),
        field("body", $.block),
      ),

    parameter_list: ($) => seq($.parameter, repeat(seq(",", $.parameter))),

    parameter: ($) =>
      seq(
        field("name", $.identifier),
        optional(seq(":", field("type", $._type_expression))),
      ),

    block: ($) => seq("{", repeat($._statement), "}"),

    // --- Continue / Return ---

    continue_expression: ($) =>
      prec.right(2, seq("continue", optional(field("label", $.label)), $._expression)),

    return_expression: ($) => prec.right(2, seq("return", $._expression)),

    // --- Composite literals ---

    table_literal: ($) =>
      seq(
        "{",
        optional(
          seq($.table_field, repeat(seq(",", $.table_field)), optional(",")),
        ),
        "}",
      ),

    table_field: ($) =>
      seq(field("key", $.identifier), ":", field("value", $._expression)),

    array_literal: ($) =>
      seq(
        "[",
        optional(
          seq($._expression, repeat(seq(",", $._expression)), optional(",")),
        ),
        "]",
      ),

    // --- Type expressions ---

    _type_expression: ($) =>
      choice(
        $.optional_type,
        $.struct_type,
        $.function_type,
        $.type_identifier,
      ),

    type_identifier: ($) => $.identifier,

    optional_type: ($) => seq("?", field("inner", $._type_expression)),

    struct_type: ($) =>
      seq(
        "{",
        optional(
          seq($.type_field, repeat(seq(",", $.type_field)), optional(",")),
        ),
        "}",
      ),

    type_field: ($) =>
      seq(field("name", $.identifier), ":", field("type", $._type_expression)),

    function_type: ($) =>
      prec.right(9, seq(
        "fn",
        "(",
        optional(
          seq(
            $._type_expression,
            repeat(seq(",", $._type_expression)),
          ),
        ),
        ")",
        optional(choice(
          seq(field("error_marker", "!"), "->", field("return_type", $._type_expression)),
          seq(field("error_marker", "!")),
          seq("->", field("return_type", $._type_expression)),
        )),
      )),

    // --- Primaries ---

    _primary: ($) =>
      choice(
        $.integer,
        $.float,
        $.string,
        $.true,
        $.false,
        $.nil,
        $.identifier,
      ),

    integer: (_) => /\d+/,

    float: (_) => /\d+\.\d+/,

    string: (_) => seq('"', repeat(choice(/[^"\\]+/, /\\./)), '"'),

    true: (_) => "true",
    false: (_) => "false",
    nil: (_) => "nil",

    identifier: (_) => /[a-zA-Z_][a-zA-Z0-9_]*/,

    comment: (_) => token(seq("//", /.*/)),
  },
});
