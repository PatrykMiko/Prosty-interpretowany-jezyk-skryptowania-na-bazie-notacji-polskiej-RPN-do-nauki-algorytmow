grammar TurLang;

program: line* EOF;

line: tokenSeq? NEWLINE;

tokenSeq: token+;

token
    : VAR
    | NUMBER
    | STRING
    | IDENT
    | LBRACE
    | RBRACE
    ;

VAR: '$' [a-zA-Z_][a-zA-Z_0-9]*;
NUMBER: '-'? [0-9]+ ('.' [0-9]+)?;
STRING: '"' (~["\\\r\n] | '\\' .)* '"';
IDENT: [a-zA-Z_][a-zA-Z_0-9]*;
LBRACE: '{';
RBRACE: '}';
NEWLINE: '\r'? '\n';
WS: [ \t]+ -> skip;
COMMENT: ';' ~[\r\n]* -> skip;
