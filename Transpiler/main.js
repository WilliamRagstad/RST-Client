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
        if (RST_SETTINGS.debugging.debug) console.log(AST);
        VARIABLES = [];                                             // CLEAR VARIABLE DICTIONARY/SYMBOL TABLE
        STYLES[s].textContent = transpile(AST).css;                     // TRANSPILER
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
    let line = 1;

    let isString = false;
    let isLineComment = false;
    let isBlockComment = false;
    let isVariable = false;
    let isRule = false;
    let isRuleValue = false;
    let isDeclaration = false;

    for (let i = 0; i < SOURCE.length; i++) {
        let cc = SOURCE[i]; // Current Character

        if (ct == "//") isLineComment = true;
        if (isLineComment && cc == "\n") { isLineComment = false; tokens.push(Token(t_comment, ct, line)); ct = ""; line++; continue; }
        if (ct == "/*") isBlockComment = true;
        if (isBlockComment && ct.endsWith("*/")) { isBlockComment = false; tokens.push(Token(t_comment, ct, line)); ct = ""; continue; }
        
        if (!isString && !isLineComment && !isBlockComment) {
            if (ct == " " || ct + cc == " ") { ct = ""; continue; }
            if (ct == T_NEWLINE) { ct = ""; line++; }
            if (cc == " ") {
                if (isRule && !isRuleValue) {
                    isRuleValue = true;
                    tokens.push(Token(t_rule, ct, line));
                    ct = "";
                    continue;
                }
            }

            if (ct == "$") { isVariable = true; }
            if (ct == "@") { isRule = true; isRuleValue  = false }

            if (cc == ":") {
                if (isDeclaration) {
                    if (isVariable) tokens.push(Token(t_variable, ct, line));
                    else tokens.push(Token(t_property, ct, line));
                    isVariable = false;
                    ct = "";
                    continue;
                }
            }

            if (cc == "{") { tokens.push(Token(t_declaration, ct.trim(), line)); tokens.push(Token(t_separator, cc, line)); ct = ""; isDeclaration = true; continue; }
            if (cc == "}") { tokens.push(Token(t_separator, cc, line)); ct = ""; isDeclaration = false; continue; }

            if (cc == ";") {
                if (isRule && isRuleValue) { tokens.push(Token(t_rule_value, ct, line)); }
                else tokens.push(Token(t_property_value, ct, line));
                isVariable = false;
                isRule = false;
                ct = "";
                tokens.push(Token(t_separator, cc, line)); // Add the ";" to the tokens list
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
    let tIndex = 0;
    function nextToken() {
        let token = TOKENS[tIndex];
        tIndex++;
        return token;
    }

    let cToken;
    while(cToken = nextToken()) {
        if (cToken.type == t_comment) { ast.push(Pattern(p_comment, cToken.value)); continue; }

        if (cToken.type == t_rule) {
            let ruleIdentifier = cToken.value;
            let ruleValue = nextToken();
            if (ruleValue.type == t_rule_value) {
                let separator = nextToken();
                if (separator.type == t_separator && separator.value == ";") {
                    ast.push(Pattern(p_rule, ruleIdentifier, ruleValue.value));
                    continue;
                }
                else {
                    unexpectedToken(separator);
                }
            }
            else {
                unexpectedToken(ruleValue);
            }
        }

        if (cToken.type == t_variable) {
            let variableValue = nextToken();
            if (variableValue.type == t_property_value) {
                let separator = nextToken();
                if (separator.type == t_separator && separator.value == ";") {
                    ast.push(Pattern(p_variable, cToken.value, variableValue.value));
                    continue;
                }
                else {
                    unexpectedToken(separator);
                }
            }
            else {
                InvalidVariableDeclaration(variableValue);
            }
        }

        if (cToken.type == t_property) {
            let propertyValue = nextToken();
            if (propertyValue.type == t_property_value) {
                let separator = nextToken();
                if (separator.type == t_separator && separator.value == ";") {
                    ast.push(Pattern(p_property, cToken.value, propertyValue.value));
                    continue;
                }
                else {
                    unexpectedToken(separator);
                }
            }
            else {
                unexpectedToken(propertyValue);
            }
        }

        if (cToken.type == t_declaration) {
            let scope = 0;
            let separatorOpen = nextToken();
            let declarationTokens = [];
            let cDeclarationToken;
            while (cDeclarationToken = nextToken()) {
                if (cDeclarationToken.type == t_separator) {
                    if (cDeclarationToken.value == "{") scope++;
                    if (cDeclarationToken.value == "}") scope--;
                }
                if (scope == -1) break;
                declarationTokens.push(cDeclarationToken);
            }
            if (scope != -1) { InvalidStatementDeclaration(cToken); continue; }
            ast.push(Pattern(p_declaration, cToken.value, parse(declarationTokens)));
            continue;
        }

        unexpectedToken(cToken);    // TODO: Change all unexpectedToken() to throw a more specific error message except this one.
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


let VARIABLES; // This will not be used if RST_SETTINGS.output.keepVariables is true.

function transpile(AST, isRoot) {
    // We transpile and return the AST
    let CSS = "";

    let IS_ROOT = true;
    if (isRoot != undefined || isRoot != null) IS_ROOT = isRoot;
    let CHILD_DECLARATIONS = [];

    function addIndentions() {
        if (!RST_SETTINGS.output.minify && !IS_ROOT) {
            CSS += "    ";
        }
    }

    // TODO: For each property value found, evaluate them as expressions...
    
    for (let i = 0; i < AST.length; i++) {
        const NODE = AST[i];

        if (NODE.type == p_comment) {
            if (RST_SETTINGS.output.keepComments) {
                let inlineComment = NODE.values[0];
                if (NODE.values[0].startsWith("//")) {
                    inlineComment = "/*" + NODE.values[0].replace("//", "") + "*/";
                }
                if (RST_SETTINGS.output.minify) {
                    CSS += inlineComment.replace(/\n/g, " "); // TODO: Trim comments more (to make them more compact)
                }
                else {
                    addIndentions();
                    CSS += inlineComment + "\n";
                }
            }
            continue;
        }

        if (NODE.type == p_rule) {
            CSS += addRule(NODE.values[0], NODE.values[1]);
            if (!RST_SETTINGS.output.minify) CSS += "\n";
            continue;
        }

        if (NODE.type == p_variable) {
            let variableName = NODE.values[0].split("$")[1];
            let propertyValue = NODE.values[1];

            if (RST_SETTINGS.output.keepVariables) {

                // TODO: If variables doesn't update when style is reloaded, force add them to :root ?

                addIndentions();
                CSS += "--" + variableName + ":"
                if (!RST_SETTINGS.output.minify) CSS += " ";
                CSS += evaluatePropertyValue(propertyValue) + ";";
                if (!RST_SETTINGS.output.minify) CSS += "\n";
            }
            else {
                //* Keep track of variables
                // Check if variable already exists, overwrite it in that case
                // Otherwise, add it to the dictionary
                var variableFound = false;
                for (var v = 0; v < VARIABLES.length; v++) {
                    if (VARIABLES[v].key == variableName) {
                        VARIABLES[v].value = propertyValue;
                        variableFound = true;
                        break;
                    }
                }
                if (!variableFound) VARIABLES.push(Variable(variableName, propertyValue));
            }
            continue;
        }

        if (NODE.type == p_property) {
            addIndentions();
            CSS += NODE.values[0] + ":"
            if (!RST_SETTINGS.output.minify) CSS += " ";
            CSS += evaluatePropertyValue(NODE.values[1]) + ";";
            if (!RST_SETTINGS.output.minify) CSS += "\n";
            continue;
        }

        if (NODE.type == p_declaration) {   // First transpile itself to css, then transpile all child declarations afterwards

            let declaration = transpile(NODE.values[1], false);

            if (IS_ROOT) {

                // Print all declarations
                addIndentions();
                CSS += NODE.values[0];
                if (!RST_SETTINGS.output.minify) CSS += " ";
                CSS += "{";
                if (!RST_SETTINGS.output.minify) CSS += "\n";
                CSS += declaration.css;

                addIndentions();
                CSS += "}";

                // Add all child declarations afterwards
                for (let d = 0; d < declaration.childDeclarations.length; d++) {
                    if (!RST_SETTINGS.output.minify) CSS += "\n";
                    CSS += NODE.values[0] + " " + declaration.childDeclarations[d].key;
                    if (!RST_SETTINGS.output.minify) CSS += " ";
                    CSS += "{";
                    if (!RST_SETTINGS.output.minify) CSS += "\n";
                    CSS += declaration.childDeclarations[d].value.css;
                    CSS += "}";
                }
                if (!RST_SETTINGS.output.minify) CSS += "\n";
            }
            else {
                // Add to child declarations
                CHILD_DECLARATIONS.push(Declaration(NODE.values[0], declaration));
            }
            continue;
        }

        unexpectedPattern(NODE);
    }

    return {
        css: CSS,
        childDeclarations: CHILD_DECLARATIONS
    }
}



/*
 
 8888b.  888888 888888 88 88b 88 888888     888888 Yb    dP    db    88     88   88    db    888888  dP"Yb  88""Yb 
  8I  Yb 88__   88__   88 88Yb88 88__       88__    Yb  dP    dPYb   88     88   88   dPYb     88   dP   Yb 88__dP 
  8I  dY 88""   88""   88 88 Y88 88""       88""     YbdP    dP__Yb  88  .o Y8   8P  dP__Yb    88   Yb   dP 88"Yb  
 8888Y"  888888 88     88 88  Y8 888888     888888    YP    dP""""Yb 88ood8 `YbodP' dP""""Yb   88    YbodP  88  Yb 
 =================================================================================================================
 
*/

function evaluatePropertyValue(expr) {
    expr = evaluateVariables(expr);
    expr = trimExpression(expr);
    return expr;
}

function evaluateVariables(expr) {
    if (!expr.endsWith(";")) expr += ";";   // End of line
    let result = "";
    let variableName = "";
    let isVariable = false;

    for (let i = 0; i < expr.length; i++) {
        const cc = expr[i];

        if (cc == "$") { isVariable = true; continue; }
        if ((isVariable && cc.match(/[^A-z-]/g) != null)) {
            isVariable = false;
            if (RST_SETTINGS.output.keepVariables) {
                result += "var(--" + variableName + ")";
            }
            else {
                let foundVar = false;
                for (let j = 0; j < VARIABLES.length; j++) {
                    const variable = VARIABLES[j];
                    if (variable.key == variableName) {
                        result += variable.value;
                        foundVar = true;
                        break;
                    }
                }
                if (!foundVar) {
                    VariableNotFound(variableName);
                }
            }
            variableName = "";
            continue;
        }
        else if (isVariable) {
            variableName += cc;
        }
        else if (cc != ";") {
            result += cc;
        }
        else {
            break;
        }
    }

    return result;
}

function trimExpression(expr) {
    let result = "";
    for (let i = 0; i < expr.length; i++) {
        const cc = expr[i];
        if (cc == ";") break;
        if (RST_SETTINGS.output.shortenPropertyValues && result[result.length - 1] == " " && cc == " ") continue;
        result += cc;
    }
    return result;
}


function addRule(rule, parameters) {
    let CSS = "";
    parameters = evaluateVariables(parameters);

    switch (rule.toLowerCase()) {
        case "@import":
            /* TODO: If rule is @import, test if file to import is .scss, and if so:
            * fetch("https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css").then(r => r.text()).then(r => console.log(r))
            */

            // TODO: Throw error if @import is referencing a local file (Ex: file://C:/...)
            
            let importFiles = parameters.split(",");
            for (let i = 0; i < importFiles.length; i++) {
                let file = importFiles[i].replace(/[\"\']/g, "");
                if (RST_SETTINGS.rules.import.underscorePrefix) file = "_" + file; // !: Bug in case file is in a folder
                    
                if (!file.includes(".") && RST_SETTINGS.rules.import.assumeScss)  {
                    file += ".scss";
                }
                
                if (file.toLowerCase().endsWith(".scss")) {
                    if (RST_SETTINGS.rules.import.enableSassImports) {
                        // Fetch the file
                        fetch("https://rawcdn.githack.com/WilliamRagstad/RTS-Client/b54c77a47dd9fdd0798798b1f20239cd139cb32d/Transpiler/partial.scss").then(r => r.text()).then(content => {
                            if (content) {
                                console.log(content);
                            }
                        })

                        // Transpile and Inject or append their content
                    }
                    else {
                        generalError("Import Sass", "The rule for importion of .scss files is disabled.");
                    }
                }
                else {
                    CSS += rule + " " + parameters + ";";
                }
            }
            break;
    
        default:    // Let CSS evaluate the rule
            CSS += rule + " " + parameters + ";";
            break;
    }


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
const t_separator = "T_SEPARATOR";

// SctS Spesific
const t_selector = "T_SELECTOR";
const t_declaration = "T_DECLARATION";
const t_property = "T_PROPERTY";
const t_property_value = "T_PROPERTY_VALUE";
const t_variable = "T_VARIABLE";
const t_rule = "T_RULE";
const t_rule_value = "T_RULE_VALUE";

const T_NEWLINE = "\n";






/*
 
 8888b.  888888 888888 88 88b 88 888888     88""Yb    db    888888 888888 888888 88""Yb 88b 88 .dP"Y8 
  8I  Yb 88__   88__   88 88Yb88 88__       88__dP   dPYb     88     88   88__   88__dP 88Yb88 `Ybo." 
  8I  dY 88""   88""   88 88 Y88 88""       88"""   dP__Yb    88     88   88""   88"Yb  88 Y88 o.`Y8b 
 8888Y"  888888 88     88 88  Y8 888888     88     dP""""Yb   88     88   888888 88  Yb 88  Y8 8bodP'
 =====================================================================================================
 
*/

// Pattern Definitions
const p_variable = "P_VARIABLE";
const p_declaration = "P_DECLARATION";
const p_rule = "P_RULE";
const p_property = "P_PROPERTY";
const p_comment = "P_COMMENT";



/*
 
 8888b.     db    888888    db    888888 Yb  dP 88""Yb 888888     888888    db     dP""b8 888888  dP"Yb  88""Yb 88 888888 .dP"Y8 
  8I  Yb   dPYb     88     dPYb     88    YbdP  88__dP 88__       88__     dPYb   dP   `"   88   dP   Yb 88__dP 88 88__   `Ybo." 
  8I  dY  dP__Yb    88    dP__Yb    88     8P   88"""  88""       88""    dP__Yb  Yb        88   Yb   dP 88"Yb  88 88""   o.`Y8b 
 8888Y"  dP""""Yb   88   dP""""Yb   88    dP    88     888888     88     dP""""Yb  YboodP   88    YbodP  88  Yb 88 888888 8bodP'
 ================================================================================================================================
 
*/

// Factories
function Token(type, value, line) { return {type: type, value: value, line: line} }
function Pattern(type, ...values) { return {type: type, values: [...values] } }
function Variable(key, value) { return {key: key, value: value} }
function Declaration(key, value) { return {key: key, value: value} }



/*
 
 888888 88""Yb 88""Yb  dP"Yb  88""Yb     888888 88  88 88""Yb  dP"Yb  Yb        dP 88 88b 88  dP""b8 
 88__   88__dP 88__dP dP   Yb 88__dP       88   88  88 88__dP dP   Yb  Yb  db  dP  88 88Yb88 dP   `" 
 88""   88"Yb  88"Yb  Yb   dP 88"Yb        88   888888 88"Yb  Yb   dP   YbdPYbdP   88 88 Y88 Yb  "88 
 888888 88  Yb 88  Yb  YbodP  88  Yb       88   88  88 88  Yb  YbodP     YP  YP    88 88  Y8  YboodP 
 ====================================================================================================
 
*/

function generalError(type, message, line) {
    if (RST_SETTINGS.debugging.shortErrorMsgs) message = message.replace(/\n/g, "\\n");
    if (line != undefined || line != null) message = message + " (line " + line + ")";
    console.error("ERROR (" + type + ") " + message);
}

function unexpectedToken(token) {
    generalError("Unexpected token: " + token.type, "`" + token.value + "` was unexpected", token.line);
}

function InvalidVariableDeclaration(token) {
    generalError("Invalid Variable Declaration", "`" + token.value + "` is not a valid variable declaration", token.line);
}

function InvalidStatementDeclaration(token) {
    generalError("Invalid Statement Declaration", "`" + token.value + "` is not a valid statement", token.line);
}



// TODO: Add line specification
function unexpectedPattern(pattern) {
    generalError("Unexpected pattern: " + pattern.type, "`" + pattern.values + "` was unexpected");
}


// TODO: Add line specification
function VariableNotFound(variableName) {
    generalError("Invalid Variable", "`" + variableName + "` was not found");
}


/*
 
 8888b.  888888 888888    db    88   88 88     888888     .dP"Y8 888888 888888 888888 88 88b 88  dP""b8 .dP"Y8 
  8I  Yb 88__   88__     dPYb   88   88 88       88       `Ybo." 88__     88     88   88 88Yb88 dP   `" `Ybo." 
  8I  dY 88""   88""    dP__Yb  Y8   8P 88  .o   88       o.`Y8b 88""     88     88   88 88 Y88 Yb  "88 o.`Y8b 
 8888Y"  888888 88     dP""""Yb `YbodP' 88ood8   88       8bodP' 888888   88     88   88 88  Y8  YboodP 8bodP'
 ==============================================================================================================
 
*/

// Default settings
let RST_SETTINGS = {
    rules: {    // @ - rule settings
        import: {
            // These settings are only available if imported file is fetched via http/https.
            enableSassImports: true,    // Send another request and transpile all imports to other .scss files,
                                        // and create a new style tag with it's corresponding css.
            documentInjection: true,    // If importSass is true, instead of just adding all external .scss as separate <style> tags, inject them where
                                        // the @import rule is and remove the rule.
            assumeScss: true,           // If no file extension is provided, assume .scss
            underscorePrefix: false     // @import 'file.scss' will look for and import the file: _file.scss
        }
        
    },
    output: {
        minify: false,                  // Make the output compact
        shortenPropertyValues: true,    // Make double spaces to single spaces in property values
        keepVariables: true,           // Convert Scss variables to CSS variables: $variable => --variable
        keepComments: false
    },
    debugging: {
        debug: true,
        shortErrorMsgs: false
    }
}