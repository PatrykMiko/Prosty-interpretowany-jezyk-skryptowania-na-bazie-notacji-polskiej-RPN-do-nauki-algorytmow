grammar TurLang;

program: statement* EOF;

statement
    : whileStmt
    | ifStmt
    | fnStmt
    | forStmt
    | exprStmt
    | NEWLINE+
    ;

whileStmt: WHILE tokenSeq block NEWLINE*;

ifStmt: IF tokenSeq block elseClause? NEWLINE*;

elseClause: NEWLINE* ELSE block;

fnStmt: FN IDENT paramList block NEWLINE*;

forStmt: FOR tokenSeq block NEWLINE*;

paramList: IDENT*;

block: LBRACE NEWLINE+ statement* RBRACE;

exprStmt: tokenSeq NEWLINE+;

tokenSeq: token+;

token
    : VAR
    | NUMBER
    | STRING
    | IDENT
    | WHILE
    | IF
    | ELSE
    | FN
    | FOR
    ;

WHILE: 'while';
IF: 'if';
ELSE: 'else';
FN: 'fn';
FOR: 'for';

VAR: '$' [a-zA-Z_][a-zA-Z_0-9]*;
NUMBER: '-'? [0-9]+ ('.' [0-9]+)?;
STRING: '"' (~["\\\r\n] | '\\' .)* '"';
IDENT: [a-zA-Z_][a-zA-Z_0-9]*;
LBRACE: '{';
RBRACE: '}';
NEWLINE: '\r'? '\n';
WS: [ \t]+ -> skip;
COMMENT: ';' ~[\r\n]* -> skip;
