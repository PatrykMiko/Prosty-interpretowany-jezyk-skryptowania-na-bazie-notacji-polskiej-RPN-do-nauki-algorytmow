export type ProgramNode = {
  type: "program";
  statements: StatementNode[];
};

export type StatementNode = ExprStatementNode | WhileNode | IfNode | FunctionDefNode;

export type ExprStatementNode = {
  type: "exprStmt";
  expr: ExprNode;
};

export type WhileNode = {
  type: "while";
  condition: ExprNode;
  body: StatementNode[];
};

export type IfNode = {
  type: "if";
  condition: ExprNode;
  thenBody: StatementNode[];
  elseBody: StatementNode[] | null;
};

export type FunctionDefNode = {
  type: "fn";
  name: string;
  params: string[];
  body: StatementNode[];
};

export type ExprNode = CommandExprNode | LiteralExprNode | VariableExprNode;

export type CommandExprNode = {
  type: "command";
  name: string;
  args: ExprNode[];
};

export type LiteralExprNode = {
  type: "literal";
  value: number | string | boolean | null;
};

export type VariableExprNode = {
  type: "variable";
  name: string;
};
