/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: "lil",

  extras: ($) => [/\s/, $.comment],

  conflicts: ($) => [],

  word: ($) => $.identifier,

  rules: {
    source_file: ($) => repeat($._statement),

    _statement: ($) =>
      choice(
        $.let_declaration,
        $.assignment,
        $.index_assignment,
        $.field_assignment,
        $.while_statement,
        $.for_statement,
        $.if_expression,
        $.defer_statement,
        $._expression,
      ),

    // --- Declarations ---

    let_declaration: ($) =>
      seq(
        "let",
        field("name", choice($.identifier, $.table_destructure, $.array_destructure)),
        optional(seq(":", field("type", $._type_expression))),
        "=",
        field("value", choice($.enum_definition, $.struct_definition, $.actor_definition, $.type_alias, $._expression)),
      ),

    table_destructure: ($) =>
      seq("{", $.identifier, repeat(seq(",", $.identifier)), optional(","), "}"),

    array_destructure: ($) =>
      seq("[", $.identifier, repeat(seq(",", $.identifier)), optional(","), "]"),

    assignment: ($) =>
      prec.right(
        1,
        seq(field("name", $.identifier), "=", field("value", $._expression)),
      ),

    index_assignment: ($) =>
      prec.right(
        1,
        seq(
          field("object", $._expression),
          "[",
          field("index", $._expression),
          "]",
          "=",
          field("value", $._expression),
        ),
      ),

    field_assignment: ($) =>
      prec.right(
        1,
        seq(
          field("object", $._expression),
          ".",
          field("field", $.identifier),
          "=",
          field("value", $._expression),
        ),
      ),

    // --- While / For / If ---

    while_statement: ($) =>
      seq(
        "while",
        "(",
        field("condition", $._expression),
        ")",
        field("body", $.block),
      ),

    for_statement: ($) =>
      seq(
        "for",
        "(",
        field("inputs", $.for_input_list),
        ")",
        "|",
        field("bindings", $.for_binding_list),
        "|",
        field("body", $.block),
      ),

    for_input_list: ($) =>
      seq($.for_input, repeat(seq(",", $.for_input))),

    for_input: ($) =>
      choice($.range_literal, $._expression),

    range_literal: ($) =>
      choice(
        seq(field("start", $._expression), "..", optional(field("end", $._expression))),
        seq(field("start", $._expression), "...", field("end", $._expression)),
      ),

    for_binding_list: ($) =>
      seq($.identifier, repeat(seq(",", $.identifier))),

    if_expression: ($) =>
      prec.right(
        seq(
          "if",
          "(",
          field("condition", $._expression),
          ")",
          field("consequence", $.block),
          optional(seq("else", field("alternative", choice($.if_expression, $.block)))),
        ),
      ),

    // --- Defer ---

    defer_statement: ($) =>
      seq("defer", field("expression", $._expression)),

    // --- Expressions ---

    _expression: ($) =>
      choice(
        $.match_expression,
        $.function_definition,
        $.template_string,
        $.continue_expression,
        $.return_expression,
        $.binary_expression,
        $.unary_expression,
        $.call_expression,
        $.struct_construction,
        $.index_expression,
        $.field_expression,
        $.parenthesized_expression,
        $.record_literal,
        $.record_explicit,
        $.array_literal,
        $._primary,
      ),

    // --- Binary expressions with precedence ---

    binary_expression: ($) =>
      choice(
        ...[
          ["or", 1],
          ["and", 2],
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
          field("operator", choice("-", "!", "try")),
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

    // Struct construction: TypeName { field: expr, ... }
    struct_construction: ($) =>
      prec(
        8,
        seq(
          field("type", $.identifier),
          "{",
          optional(
            seq($.record_field, repeat(seq(",", $.record_field)), optional(",")),
          ),
          "}",
        ),
      ),

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
        "(",
        field("scrutinee", $._expression),
        ")",
        "{",
        optional($.match_body),
        "}",
      ),

    match_body: ($) => repeat1($.match_arm),

    match_arm: ($) =>
      seq(
        field("pattern", $._pattern),
        optional(seq("|", field("binding", $.identifier), "|")),
        field("body", $.block),
      ),

    _pattern: ($) =>
      choice(
        $.enum_variant_pattern,
        $.variant_pattern,
        $.negative_literal,
        $.integer,
        $.float,
        $.string,
        $.true,
        $.false,
        $.nil,
        $.identifier,
      ),

    negative_literal: ($) => prec(7, seq("-", choice($.integer, $.float))),

    enum_variant_pattern: ($) =>
      seq(
        field("enum", $.identifier),
        ".",
        field("variant", $.identifier),
        optional(seq("(", field("binding", $.identifier), ")")),
      ),

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

    // --- Structs ---

    struct_definition: ($) =>
      seq(
        "struct",
        "{",
        optional(
          seq($.struct_member, repeat(seq(",", $.struct_member)), optional(",")),
        ),
        "}",
      ),

    struct_member: ($) =>
      choice(
        // Data field: name: Type
        seq(field("name", $.identifier), ":", field("type", $._type_expression)),
        // Method: name = function(...) { }
        seq(field("name", $.identifier), "=", field("value", $.function_definition)),
      ),

    // --- Actors ---

    actor_definition: ($) =>
      seq(
        "actor",
        "{",
        optional(
          seq($.actor_field, repeat(seq(",", $.actor_field)), optional(",")),
        ),
        "}",
      ),

    actor_field: ($) =>
      seq(field("name", $.identifier), "=", field("value", $._expression)),

    // --- Type alias ---

    type_alias: ($) =>
      seq("type", field("type", $._type_expression)),

    // --- Template strings ---

    template_string: ($) =>
      seq(
        "string",
        "{",
        repeat(choice($.template_content, $.template_interpolation)),
        "}",
      ),

    template_content: (_) => /[^|{}]+/,

    template_interpolation: ($) =>
      seq("|", field("expression", $.identifier), "|"),

    // --- Functions ---

    function_definition: ($) =>
      seq(
        "function",
        "(",
        field("parameters", optional($.parameter_list)),
        ")",
        optional(field("error_marker", "!")),
        optional(field("return_type", choice($.type_identifier, $.optional_type, $.function_type))),
        field("body", $.block),
      ),

    parameter_list: ($) => seq($.parameter, repeat(seq(",", $.parameter))),

    parameter: ($) =>
      choice(
        seq(
          field("name", $.identifier),
          optional(seq(":", field("type", $._type_expression))),
        ),
        seq("{", field("name", $.identifier), repeat(seq(",", field("name", $.identifier))), optional(","), "}"),
        seq("[", field("name", $.identifier), repeat(seq(",", field("name", $.identifier))), optional(","), "]"),
      ),

    block: ($) => seq("{", repeat($._statement), "}"),

    // --- Continue / Return ---

    continue_expression: ($) =>
      prec.right(2, seq("continue", optional(field("label", $.label)), $._expression)),

    return_expression: ($) => prec.right(2, seq("return", $._expression)),

    // --- Composite literals ---

    record_literal: ($) =>
      seq(
        "{",
        optional(
          seq($.record_field, repeat(seq(",", $.record_field)), optional(",")),
        ),
        "}",
      ),

    record_explicit: ($) =>
      seq(
        "record",
        "{",
        optional(
          seq($.record_field, repeat(seq(",", $.record_field)), optional(",")),
        ),
        "}",
      ),

    record_field: ($) =>
      choice(
        seq(field("key", $.identifier), ":", field("value", $._expression)),
        field("key", $.identifier),
      ),

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
        "function",
        "(",
        optional(
          seq(
            $._type_expression,
            repeat(seq(",", $._type_expression)),
          ),
        ),
        ")",
        optional(field("error_marker", "!")),
        optional(field("return_type", $._type_expression)),
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
