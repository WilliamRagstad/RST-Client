/***
 *
 *    88888888ba    ad88888ba  888888888888
 *    88      "8b  d8"     "8b      88
 *    88      ,8P  Y8,              88
 *    88aaaaaa8P'  `Y8aaaaa,        88
 *    88""""88'      `"""""8b,      88
 *    88    `8b            `8b      88
 *    88     `8b   Y8a     a8P      88
 *    88      `8b   "Y88888P"       88
 *
 *    Real-time Sass Transpiler - v.Alpha
 *    -----------------------------------
 * 
 *        Welcome to the RST Project.
 *       This is a transpiler for Sass
 *      written compleatly in JavaScript.
 *                   . . .
 *        If you're interested in more
 *     projects like this, pleaes consider
 *     following me on GitHub and Twitter!
 * 
 *              @williamragstad
 */

// Attaching to DOMContentLoaded -> Transpile all style elements
window.addEventListener('DOMContentLoaded', () => {
    const STYLES = document.getElementsByTagName("style");
    for (let s = 0; s < STYLES.length; s++) {
        const SOURCE = STYLES[s].textContent + T_NEWLINE;           // SINGLE INPUT
        const TOKENS = lex(SOURCE);                                 // LEXER
        if (RST_SETTINGS.debugging.debug) console.table(TOKENS);
        const AST = parse(TOKENS);                                  // PARSER
        if (RST_SETTINGS.debugging.debug)console.log(AST);
        STYLES[s].textContent = transpile(AST);                     // TRANSPILER
    }
});








/*
 
  8888b.  888888 888888 88 88b 88 888888    88     888888 Yb  dP 888888 88""Yb 
  8I  Yb 88__   88__   88 88Yb88 88__       88     88__    YbdP  88__   88__dP 
  8I  dY 88""   88""   88 88 Y88 88""       88  .o 88""    dPYb  88""   88"Yb  
 8888Y"  888888 88     88 88  Y8 888888     88ood8 888888 dP  Yb 888888 88  Yb
 =============================================================================
 
*/

function lex(SOURCE) {
    // Tokenize the SOURCE
    const tokens = []; // Results
    let ct = "";     // Current Token

    let isString = false;
    let isLineComment = false;
    let isBlockComment = false;
    let isVariable = false;
    let isRule = false;

    for (let i = 0; i < SOURCE.length; i++) {
        let cc = SOURCE[i]; // Current Character

        if (ct == "//") isLineComment = true;
        if (isLineComment && cc == "\n") { isLineComment = false; tokens.push(Token(t_comment, ct)); ct = ""; continue; }
        if (ct == "/*") isBlockComment = true;
        if (isBlockComment && ct.endsWith("*/")) { isBlockComment = false; tokens.push(Token(t_comment, ct)); ct = ""; continue; }
        
        if (!isString && !isLineComment && !isBlockComment) {
            if (ct == " " || ct + cc == " ") { ct = ""; continue; }
            if (ct == T_NEWLINE) { ct = ""; }

            if (ct == "$") isVariable = true;
            if (ct == "@") isRule = true;

            if (cc == ":") {
                if (isVariable) tokens.push(Token(t_variable, ct));
                else tokens.push(Token(t_property, ct));
                isVariable = false;
                ct = "";
                continue;
            }

            if (cc == "{") { tokens.push(Token(t_declaration_start, ct.trim())); ct = ""; continue; }
            if (ct == "}") { tokens.push(Token(t_declaration_end,   "")); ct = ""; continue; }

            if (cc == ";") {
                if (isRule) tokens.push(Token(t_rule, ct));
                else tokens.push(Token(t_property_value, ct));
                isVariable = false;
                isRule = false;
                ct = "";
                continue;
            }
        }

        ct += cc;
    }

    return tokens;
}






/*
 
 8888b.  888888 888888 88 88b 88 888888     88""Yb    db    88""Yb .dP"Y8 888888 88""Yb 
  8I  Yb 88__   88__   88 88Yb88 88__       88__dP   dPYb   88__dP `Ybo." 88__   88__dP 
  8I  dY 88""   88""   88 88 Y88 88""       88"""   dP__Yb  88"Yb  o.`Y8b 88""   88"Yb  
 8888Y"  888888 88     88 88  Y8 888888     88     dP""""Yb 88  Yb 8bodP' 888888 88  Yb
 ======================================================================================
 
*/

function parse(TOKENS) {
    // Create an AST using the tokens
    const ast = [];
    let pattern = [];

    for (let i = 0; i < TOKENS.length; i++) {
        const ct = TOKENS[i];
        pattern.push(ct);

        if (pattern.length >= 1) {
            // DECLARATION
            if (pattern[0].type == declaration_start &&
                pattern[pattern.length - 1].type == declaration_end) {
                let d = Pattern(declaration, pattern[0].value, null);
                d.children = parser(pattern.slice(1, pattern.length-2));
                ast.push(d);
                pattern = [];
                continue;
            }
            // COMMENT
            if (pattern[0].type == comment) {
                pattern = [];
                continue;
            }
            // RULE
            if (pattern[0].type == rule) {
                pattern.push(Pattern(rule, pattern[0].value));
                pattern = [];
                continue;
            }
            if (pattern.length >= 2) {
                //  PROPERTY DECLARATION
                if (pattern[0].type == property && pattern[1].type == property_value) {
                    pattern.push(Pattern(property, null, pattern));
                    pattern = [];
                    continue;
                }
                // VARIABLE DECLARATION
                if (pattern[0].type == variable && pattern[1].type == property_value) {
                    pattern.push(Pattern(variable, null, pattern));
                    pattern = [];
                    continue;
                }
            }
        }

        console.log("Unexpected token: ", pattern);

    }
    return ast;
}






/*
 
 8888b.  888888 888888 88 88b 88 888888     888888 88""Yb    db    88b 88 .dP"Y8 88""Yb 88 88     888888 88""Yb 
  8I  Yb 88__   88__   88 88Yb88 88__         88   88__dP   dPYb   88Yb88 `Ybo." 88__dP 88 88     88__   88__dP 
  8I  dY 88""   88""   88 88 Y88 88""         88   88"Yb   dP__Yb  88 Y88 o.`Y8b 88"""  88 88  .o 88""   88"Yb  
 8888Y"  888888 88     88 88  Y8 888888       88   88  Yb dP""""Yb 88  Y8 8bodP' 88     88 88ood8 888888 88  Yb
 ==============================================================================================================
 
*/

function transpile(AST) {
    // We transpile and return the AST
    let CSS = "";

    

    return CSS;
}






/*
 
 8888b.  888888 888888 88 88b 88 888888     888888  dP"Yb  88  dP 888888 88b 88 .dP"Y8 
  8I  Yb 88__   88__   88 88Yb88 88__         88   dP   Yb 88odP  88__   88Yb88 `Ybo." 
  8I  dY 88""   88""   88 88 Y88 88""         88   Yb   dP 88"Yb  88""   88 Y88 o.`Y8b 
 8888Y"  888888 88     88 88  Y8 888888       88    YbodP  88  Yb 888888 88  Y8 8bodP'
 =====================================================================================
 
*/

// Token Definitions
const t_identifier = "T_IDENTIFIER";
const t_keyword = "T_KEYWORD";
const t_operator = "T_OPERATOR";
const t_literal = "T_LITERAL";
const t_comment = "T_COMMENT";

// SctS Spesific
const t_selector = "T_SELECTOR";
const t_declaration = "T_DECLARATION";
const t_declaration_start = "T_DECLARATION_START";
const t_declaration_end = "T_DECLARATION_END";
const t_property = "T_PROPERTY";
const t_property_value = "T_PROPERTY_VALUE";
const t_variable = "T_VARIABLE";
const t_rule = "T_RULE";

const T_NEWLINE = "\n";






/*
 
 8888b.  888888 888888 88 88b 88 888888     88""Yb    db    888888 888888 888888 88""Yb 88b 88 .dP"Y8 
  8I  Yb 88__   88__   88 88Yb88 88__       88__dP   dPYb     88     88   88__   88__dP 88Yb88 `Ybo." 
  8I  dY 88""   88""   88 88 Y88 88""       88"""   dP__Yb    88     88   88""   88"Yb  88 Y88 o.`Y8b 
 8888Y"  888888 88     88 88  Y8 888888     88     dP""""Yb   88     88   888888 88  Yb 88  Y8 8bodP'
 =====================================================================================================
 
*/

// Pattern Definitions
const p_variable_decl = "P_VARIABLE_DECL";






/*
 
 8888b.     db    888888    db    888888 Yb  dP 88""Yb 888888     888888    db     dP""b8 888888  dP"Yb  88""Yb 88 888888 .dP"Y8 
  8I  Yb   dPYb     88     dPYb     88    YbdP  88__dP 88__       88__     dPYb   dP   `"   88   dP   Yb 88__dP 88 88__   `Ybo." 
  8I  dY  dP__Yb    88    dP__Yb    88     8P   88"""  88""       88""    dP__Yb  Yb        88   Yb   dP 88"Yb  88 88""   o.`Y8b 
 8888Y"  dP""""Yb   88   dP""""Yb   88    dP    88     888888     88     dP""""Yb  YboodP   88    YbodP  88  Yb 88 888888 8bodP'
 ================================================================================================================================
 
*/

// Factories
function Token(type, value) { return {type: type, value: value} }
function Pattern(type, value,...children) { return {type: type, value: value, children: [...children]} }






/*
 
 8888b.  888888 888888    db    88   88 88     888888     .dP"Y8 888888 888888 888888 88 88b 88  dP""b8 .dP"Y8 
  8I  Yb 88__   88__     dPYb   88   88 88       88       `Ybo." 88__     88     88   88 88Yb88 dP   `" `Ybo." 
  8I  dY 88""   88""    dP__Yb  Y8   8P 88  .o   88       o.`Y8b 88""     88     88   88 88 Y88 Yb  "88 o.`Y8b 
 8888Y"  888888 88     dP""""Yb `YbodP' 88ood8   88       8bodP' 888888   88     88   88 88  Y8  YboodP 8bodP'
 ==============================================================================================================
 
*/

// Default settings
let RST_SETTINGS = {
    rules: {
        import: "css"           // All imports are to CSS files
    },
    output: {
        minify: true,           // Make the output compact
        keepVariables: false    // Convert Scss variables to CSS variables: $variable => --variable
    },
    debugging: {
        debug: true
    }
}