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
    VARIABLES = []; // CLEAR VARIABLE DICTIONARY/SYMBOL TABLE

    // Transpile all style tags
    const STYLES = document.getElementsByTagName("style");
    for (let s = 0; s < STYLES.length; s++) {
        transpileStyleElement(STYLES[s]);
    }
    // Fetch all link tags with href ending with .scss
    if (RST_SETTINGS.link.enableSassLinking) {
        const LINKS = document.querySelectorAll('link[href*=".scss"]');
        for (let s = 0; s < LINKS.length; s++) {
            transpileLinkElement(LINKS[s]);
        }
    }
});

async function transpileStyleElement(styleElement) {
    const SOURCE = styleElement.textContent + T_NEWLINE;        // SINGLE INPUT
    const TOKENS = lex(SOURCE);                                 // LEXER
    if (RST_SETTINGS.debugging.debug) console.table(TOKENS);
    const AST = parse(TOKENS);                                  // PARSER
    if (RST_SETTINGS.debugging.debug) console.log(AST);
    const RESULT = await transpile(AST);                        // TRANSPILER
    if (RST_SETTINGS.debugging.debug) console.log(RESULT);
    styleElement.textContent = RESULT.css;
}

async function transpileLinkElement(linkElement) {
    const HREF = linkElement.getAttribute("href");
    const RESPONSE = await fetch(HREF);
    const RESPONSE_TEXT = await RESPONSE.text();
    const SOURCE = RESPONSE_TEXT + T_NEWLINE;        // SINGLE INPUT
    const TOKENS = lex(SOURCE);                                 // LEXER
    if (RST_SETTINGS.debugging.debug) console.table(TOKENS);
    const AST = parse(TOKENS);                                  // PARSER
    if (RST_SETTINGS.debugging.debug) console.log(AST);
    let HREF_DIR = HREF.split("/");
    HREF_DIR = HREF_DIR.splice(0, HREF_DIR.length - 1).join("/") + "/";
    const RESULT = await transpile(AST, null, HREF_DIR);                        // TRANSPILER
    if (RST_SETTINGS.debugging.debug) console.log(RESULT);

    let styleElement = document.createElement("style");
    let content = RESULT.css;

    if (RST_SETTINGS.link.showLinkFileHeaders) {
        let commentStart = "/*";
        if (!RST_SETTINGS.output.minify) commentStart += " ";
        commentStart += "START OF LINKED FILE: " + HREF;
        if (!RST_SETTINGS.output.minify) commentStart += " ";
        commentStart += "*/";
        if (!RST_SETTINGS.output.minify) commentStart += "\n";

        let commentEnd = "/*";
        if (!RST_SETTINGS.output.minify) commentEnd += " ";
        commentEnd += "END OF LINKED FILE: " + HREF;
        if (!RST_SETTINGS.output.minify) commentEnd += " ";
        commentEnd += "*/";
        if (!RST_SETTINGS.output.minify) commentEnd += "\n";

        content = commentStart + content + commentEnd;
    }

    styleElement.textContent = content;
    if (RST_SETTINGS.link.documentInjection) {
        linkElement.parentElement.appendChild(styleElement);
    }
    else {
        document.body.appendChild(styleElement);
    }
    linkElement.parentElement.removeChild(linkElement);
}

/*
window.addEventListener("load", myOnLoad);

async function myOnLoad() {
    let response = await fetch('https://raw.githubusercontent.com/WilliamRagstad/RST-Client/master/Transpiler/partial.scss');
    response.text().then(data => {
        console.log(data);
    });
}
*/



/*
 
  8888b.  888888 888888 88 88b 88 888888    88     888888 Yb  dP 888888 88""Yb 
  8I  Yb 88__   88__   88 88Yb88 88__       88     88__    YbdP  88__   88__dP 
  8I  dY 88""   88""   88 88 Y88 88""       88  .o 88""    dPYb  88""   88"Yb  
 8888Y"  888888 88     88 88  Y8 888888     88ood8 888888 dP  Yb 888888 88  Yb
 =============================================================================
 
*/

function lex(SOURCE) {
    // Lexer utility functions
    // Next nearest upcoming character
    function peekNext(startIndex, values) {
        for (let j = startIndex; j < SOURCE.length; j++) if (values.includes(SOURCE[j])) return SOURCE[j];
        return false;
    }

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
        let nc = i + 1 < SOURCE.length  ? SOURCE[i+1] : ""; // Next Character

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
                // Peek if there's a { coming up...
                const type = peekNext(i, [";", "{"]);
                if (type == "{") {
                    ct += cc;
                    continue;
                }
                else if (type == ";") {
                    if (isVariable) tokens.push(Token(t_variable, ct, line));
                    else tokens.push(Token(t_property, ct, line));
                    isVariable = false;
                    ct = "";
                    continue;
                }
                else {
                    generalError("Unexpected Token", "The token ':' was unexpected here.", line);
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
            debugger

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
            else if (ruleIdentifier.toLowerCase() == "@mixin" && ruleValue.type == t_declaration) { //* Mixins
                //TODO: Implement
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
            let separatorOpen = nextToken(); // Just pop the token off the stack...
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

async function transpile(AST, isRoot, context) {
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
            const RESULT = await addRule(NODE.values[0], NODE.values[1], context);
            CSS += RESULT;
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
            //debugger;
            const declaration = await transpile(NODE.values[1], false);

            if (IS_ROOT) {

                if (declaration.css.trim() == "" && RST_SETTINGS.output.removeEmptyDeclarations) { /* Don't add */ }
                else {
                    // Print all declarations
                    addIndentions();
                    CSS += NODE.values[0];
                    if (!RST_SETTINGS.output.minify) CSS += " ";
                    CSS += "{";
                    if (!RST_SETTINGS.output.minify) CSS += "\n";
                    CSS += declaration.css;

                    addIndentions();
                    CSS += "}";
                }

                // Add all child declarations afterwards
                function transpileDeclaration(decl, prefix) {
                    result = "";
                    if (decl.key.includes("&")) {
                        prefix = decl.key.replace(new RegExp("&", "g"), prefix);
                    }
                    else {
                        prefix = prefix + " " + decl.key;
                    }
                    if (decl.value.css.trim() == "" && RST_SETTINGS.output.removeEmptyDeclarations) { /* Don't add */ }
                    else {
                        if (!RST_SETTINGS.output.minify) result += "\n";
                        result += prefix;
                        if (!RST_SETTINGS.output.minify) result += " ";
                        result += "{";
                        if (!RST_SETTINGS.output.minify) result += "\n";
                        result += decl.value.css;
                        result += "}";
                    }

                    for (let d = 0; d < decl.value.childDeclarations.length; d++) {
                        result += transpileDeclaration(decl.value.childDeclarations[d], prefix);
                    }

                    // Transpile all child declarations

                    return result;
                }

                // Transpile all child declarations
                for (let d = 0; d < declaration.childDeclarations.length; d++) {
                    CSS += transpileDeclaration(declaration.childDeclarations[d], NODE.values[0]);
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


async function addRule(rule, parameters, context) {
    context = context == undefined ? "" : context;
    let CSS = "";
    parameters = evaluateVariables(parameters);

    switch (rule.toLowerCase()) {
        case "@import":
            /* TODO: If rule is @import, test if file to import is .scss, and if so:
            * fetch("https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css").then(r => r.text()).then(r => console.log(r))
            */

            // TODO: Throw error if @import is referencing a local file (Ex: file://C:/...)
            let filepath = parameters.replace(/[\"\']/g, "").split("/");
            if (RST_SETTINGS.rules.import.underscorePrefix)
                filepath[filepath.length - 1] = "_" + filepath[filepath.length - 1];
            if (!filepath[filepath.length - 1].includes(".") && RST_SETTINGS.rules.import.assumeScss)
                filepath[filepath.length - 1] = filepath[filepath.length - 1] + ".scss";

            let filename = filepath[filepath.length - 1];
            if (filepath[filepath.length - 1].toLowerCase().endsWith(".scss")) {
                if (RST_SETTINGS.rules.import.enableSassImports) {
                    // Fetch the file
                    try {
                        const response = await fetch(context + filepath.join("/"));
                        let responseText = await response.text();
                        
                        if (responseText) {

                            if (RST_SETTINGS.debugging.debug) console.log("Importing and transpiling: " + filename);

                            // Transpile response

                            const SOURCE = responseText + T_NEWLINE; // SINGLE INPUT
                            const TOKENS = lex(SOURCE); // LEXER
                            console.log(TOKENS);
                            const AST = parse(TOKENS); // PARSER
                            console.log(AST);
                            
                            let HREF_DIR = filepath.splice(0, filepath.length - 1).join("/") + "/";
                            const RESULT = await transpile(AST, null, context + HREF_DIR);
                            let content = RESULT.css; // TRANSPILER

                            if (RST_SETTINGS.rules.import.showImportFileHeaders) {
                                let commentStart = "/*";
                                if (!RST_SETTINGS.output.minify) commentStart += " ";
                                commentStart += "START OF IMPORTED FILE: " + filename;
                                if (!RST_SETTINGS.output.minify) commentStart += " ";
                                commentStart += "*/";
                                if (!RST_SETTINGS.output.minify) commentStart += "\n";

                                let commentEnd = "/*";
                                if (!RST_SETTINGS.output.minify) commentEnd += " ";
                                commentEnd += "END OF IMPORTED FILE: " + filename;
                                if (!RST_SETTINGS.output.minify) commentEnd += " ";
                                commentEnd += "*/";
                                if (!RST_SETTINGS.output.minify) commentEnd += "\n";

                                content = commentStart + content + commentEnd;
                            }

                            // Inject or append the transpiled response

                            if (RST_SETTINGS.rules.import.documentInjection) {
                                // Inject content in CSS
                                CSS += content;
                                if (RST_SETTINGS.debugging.debug) console.log("Injected file to document");
                            } else {
                                // Create new <style> with content
                                let styleElement = document.createElement("style");
                                styleElement.textContent = content;
                                document.body.appendChild(styleElement);
                                if (RST_SETTINGS.debugging.debug) console.log("Appended file to document");
                            }
                        } else {
                            generalError("Import Sass", "Failed to load content: unkown error...");
                            CSS += rule + " " + parameters + ";";
                        }

                    } catch (error) {
                        generalError("Import Sass", "Failed to load content: " + error);
                        CSS += rule + " " + parameters + ";";
                    }
                    
                } else {
                    generalError("Import Sass", "The rule for importion of .scss files is disabled.");
                    CSS += rule + " " + parameters + ";";
                }
            } else {
                CSS += rule + " " + parameters + ";";
            }
            break;

        default: // Let CSS evaluate the rule
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
const t_identifier  = "T_IDENTIFIER";
const t_keyword     = "T_KEYWORD";
const t_operator    = "T_OPERATOR";
const t_literal     = "T_LITERAL";
const t_comment     = "T_COMMENT";
const t_separator   = "T_SEPARATOR";

// SctS Spesific
const t_selector        = "T_SELECTOR";
const t_declaration     = "T_DECLARATION";
const t_property        = "T_PROPERTY";
const t_property_value  = "T_PROPERTY_VALUE";
const t_variable        = "T_VARIABLE";
const t_rule            = "T_RULE";
const t_rule_value      = "T_RULE_VALUE";

// Other
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
            documentInjection: false,    // If importSass is true, instead of just adding all external .scss as separate <style> tags, inject them where
                                        // the @import rule is and remove the rule.
            assumeScss: true,           // If no file extension is provided, assume .scss
            underscorePrefix: false,    // @import 'file.scss' will look for and import the file: _file.scss
            showImportFileHeaders: true // Show where imported files are imported from
        }
    },
    link: {
        // These settings are only available if imported file is fetched via http/https.
        enableSassLinking: true,    // Just as a <link rel="stylesheet" href="https://.../style.css">, you can link to .scss files aswell
        documentInjection: false,   // If SassLinking is true, instead of just adding all external .scss as separate <style> tags, inject them where
                                    // the <link> tag was
        showLinkFileHeaders: true   // Show where linked files are imported from
    },
    output: {
        minify: false,                  // Make the output compact
        shortenPropertyValues: true,    // Make double spaces to single spaces in property values
        keepVariables: true,           // Convert Scss variables to CSS variables: $variable => --variable
        keepComments: false,
        removeEmptyDeclarations: false  // Removes redundant/empty declarations
    },
    debugging: {
        debug: true,
        shortErrorMsgs: false
    }
}



/*
 * Minify main.js using:
 * 
 * uglifyjs main.js --compress --mangle --output min.js
*/