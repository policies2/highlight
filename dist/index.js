const LABEL_PREDICATES = [
    // Positive predicates
    "clears",
    "succeeds",
    "qualifies",
    "passes",
    "meets requirements",
    "satisfies",
    "is valid",
    "is approved",
    "has passed",
    "is authorized",
    "is sanctioned",
    "is certified",
    "is permitted",
    "is legitimate",
    "is satisfied",
    // Negated predicates
    "fails",
    "does not clear",
    "does not succeed",
    "does not qualify",
    "does not pass",
    "does not meet requirements",
    "does not satisfy",
    "is not valid",
    "is not approved",
    "has not passed",
    "is not authorized",
    "is not sanctioned",
    "is not certified",
    "is not permitted",
    "is not legitimate",
    "is not satisfied",
];
export const highlightText = (text, colors) => {
    // Escape &, <, >
    let html = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    // Step 1: Find all defined rules (action parts) and their full definition lines
    const lines = html.split("\n");
    const allDefinedRuleActions = new Set();
    const definitionLineToActionMap = new Map();
    const labeledRules = new Map();
    lines.forEach((line) => {
        const matchWithLabel = line.match(/^([\w.]+)\.\s+(?:An?|The)\s+\*\*\w+\*\*\s+(.+)$/);
        const matchWithoutLabel = line.match(/^((?:An?|The)\s+\*\*\w+\*\*\s+)(.+)$/);
        if (matchWithLabel?.[1] && matchWithLabel[2] !== undefined) {
            const label = matchWithLabel[1];
            const ruleAction = matchWithLabel[2].trim();
            allDefinedRuleActions.add(ruleAction);
            definitionLineToActionMap.set(line.trim(), ruleAction);
            labeledRules.set(label, ruleAction);
        }
        else if (matchWithoutLabel && matchWithoutLabel[2] !== undefined) {
            const ruleAction = matchWithoutLabel[2].trim();
            allDefinedRuleActions.add(ruleAction);
            definitionLineToActionMap.set(line.trim(), ruleAction);
        }
        // Shorthand labels: `name:` before `if`. Stored with empty value so the
        // rule-action machinery treats them as label-only (no verbose action).
        const shorthandLabel = line.match(/^([\w.]+):\s+if\b/);
        if (shorthandLabel?.[1]) {
            labeledRules.set(shorthandLabel[1], "");
        }
    });
    // Step 2: Determine which defined rules are actually referenced elsewhere
    const rulesWithExternalReferences = new Set();
    lines.forEach((currentLine) => {
        const trimmedCurrentLine = currentLine.trim();
        const actionPartOfCurrentDefinition = definitionLineToActionMap.get(trimmedCurrentLine);
        for (const definedAction of allDefinedRuleActions) {
            const escapedDefinedAction = definedAction.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const referencePattern = new RegExp(`\\b(${escapedDefinedAction})\\b`, "gi");
            let match;
            while ((match = referencePattern.exec(currentLine)) !== null) {
                const matchedText = match[1];
                if (!(actionPartOfCurrentDefinition &&
                    matchedText === actionPartOfCurrentDefinition)) {
                    rulesWithExternalReferences.add(definedAction);
                }
            }
        }
        const predicatePatternForDetection = LABEL_PREDICATES.map((p) => p.replace(/\s+/g, "\\s+")).join("|");
        const labelReferencePattern = new RegExp(`[§$]([\\w.]+)(?:\\s+(?:${predicatePatternForDetection}))?`, "g");
        let labelMatch;
        while ((labelMatch = labelReferencePattern.exec(currentLine)) !== null) {
            const referencedLabel = labelMatch[1];
            if (referencedLabel && labeledRules.has(referencedLabel)) {
                const labeledAction = labeledRules.get(referencedLabel);
                if (labeledAction) {
                    rulesWithExternalReferences.add(labeledAction);
                }
            }
        }
    });
    // Step 3: Create a placeholder system to protect HTML tags
    const placeholders = [];
    let placeholderIndex = 0;
    const createPlaceholder = (content) => {
        const placeholder = `\x00PLACEHOLDER${placeholderIndex}\x00`;
        placeholders[placeholderIndex] = content;
        placeholderIndex++;
        return placeholder;
    };
    // Step 4: Apply highlighting based on our pre-analysis
    const processedHtmlLines = [];
    lines.forEach((originalLine) => {
        let lineHtml = originalLine;
        const trimmedOriginalLine = originalLine.trim();
        const actionPartOfThisDefinition = definitionLineToActionMap.get(trimmedOriginalLine);
        const isDefinitionLine = !!actionPartOfThisDefinition;
        if (isDefinitionLine && actionPartOfThisDefinition) {
            if (rulesWithExternalReferences.has(actionPartOfThisDefinition)) {
                const escapedAction = actionPartOfThisDefinition.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                const definitionActionPattern = new RegExp(`^(?:[\\w.]+\\.\\s+)?(?:An?|The)\\s+\\*\\*\\w+\\*\\*\\s+(${escapedAction})$`);
                lineHtml = lineHtml.replace(definitionActionPattern, (_match, actionPart) => {
                    const prefixMatch = originalLine.match(/^(?:[\w.]+\.\s+)?(?:An?|The)\s+\*\*\w+\*\*(\s+)?/);
                    const prefix = prefixMatch ? prefixMatch[0] : "";
                    return `${prefix}${createPlaceholder(`<span class="${colors.referenced}">${actionPart}</span>`)}`;
                });
            }
        }
        for (const definedAction of allDefinedRuleActions) {
            const escapedDefinedAction = definedAction.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const generalReferencePattern = new RegExp(`\\b(${escapedDefinedAction})\\b`, "gi");
            lineHtml = lineHtml.replace(generalReferencePattern, (match, p1) => {
                if (match.startsWith("\x00PLACEHOLDER") && match.endsWith("\x00")) {
                    return match;
                }
                if (isDefinitionLine &&
                    p1 === actionPartOfThisDefinition &&
                    !rulesWithExternalReferences.has(actionPartOfThisDefinition)) {
                    return match;
                }
                return createPlaceholder(`<span class="${colors.reference}">${match}</span>`);
            });
        }
        processedHtmlLines.push(lineHtml);
    });
    html = processedHtmlLines.join("\n");
    // Step 5: Apply all other static highlighting rules
    // Comments
    html = html.replace(/(^#.*$)/gm, (match) => {
        return createPlaceholder(`<span class="${colors.comment}">${match}</span>`);
    });
    // String literals
    html = html.replace(/"([^"\\]|\\.)*"/g, (match) => {
        return createPlaceholder(`<span class="${colors.string}">${match}</span>`);
    });
    html = html.replace(/'([^'\\]|\\.)*'/g, (match) => {
        return createPlaceholder(`<span class="${colors.string}">${match}</span>`);
    });
    // Dates
    html = html.replace(/\bdate\(\d{4}-\d{2}-\d{2}\)/g, (match) => {
        return createPlaceholder(`<span class="${colors.date}">${match}</span>`);
    });
    html = html.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (match) => {
        return createPlaceholder(`<span class="${colors.date}">${match}</span>`);
    });
    // Numbers
    html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, (_match, p1) => {
        return createPlaceholder(`<span class="${colors.number}">${p1}</span>`);
    });
    html = html.replace(/\b((?:year|day|week|month)s?)\b/g, (_match, p1) => {
        return createPlaceholder(`<span class="${colors.number}">${p1}</span>`);
    });
    // Booleans
    html = html.replace(/\b(false)\b/g, (_match, p1) => {
        return createPlaceholder(`<span class="${colors.false}">${p1}</span>`);
    });
    html = html.replace(/\b(true)\b/g, (_match, p1) => {
        return createPlaceholder(`<span class="${colors.true}">${p1}</span>`);
    });
    // Comparison phrases (functions)
    const comparisonPhrases = [
        // Prefix functions
        "length of",
        "number of",
        "sum of",
        "average of",
        "avg of",
        "mean of",
        "min of",
        "minimum of",
        "smallest of",
        "max of",
        "maximum of",
        "largest of",
        "floor of",
        "ceil of",
        "ceiling of",
        "round of",
        "abs of",
        "absolute of",
        "power of",
        "to the power of",
        // Dynamic key lookup keywords
        "looked up in",
        "resolved through",
        // Comparison operators
        "is greater than or equal to",
        "is at least",
        "is less than or equal to",
        "is no more than",
        "is exactly equal to",
        "is exactly",
        "is equal to",
        "is like",
        "is the same as",
        "is not equal to",
        "is not the same as",
        "is later than",
        "is earlier than",
        "is greater than",
        "is less than",
        "is older than",
        "is younger than",
        "is between",
        "is in the past",
        "is in the future",
        "is in",
        "is not in",
        "is within",
        "between",
        "not in",
        "in",
        "contains all of",
        "contains any of",
        "contains",
        "starts with",
        "ends with",
        // Existence / emptiness
        "does not exist",
        "is not empty",
        "is not null",
        "is empty",
        "is null",
        "exists",
        // Format validation - binary
        "has the format",
        "has format",
        "matches pattern",
        "matches regex",
        // Format validation - unary
        "is a valid email",
        "is a valid url",
        "is a valid uuid",
        "is a valid phone number",
        "is a valid phone",
        "is a valid date",
        "is a valid time",
        "is a valid datetime",
        "is a valid iso8601",
        "is not a valid email",
        "is not a valid url",
        "is not a valid uuid",
        "is not a valid phone number",
        "is not a valid phone",
        "is not a valid date",
        "is not a valid time",
        "is not a valid datetime",
        "is not a valid iso8601",
    ];
    const escapedPhrases = comparisonPhrases.map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const phrasePattern = new RegExp(`\\b(${escapedPhrases.join("|")})\\b`, "g");
    html = html.replace(phrasePattern, (match) => {
        return createPlaceholder(`<span class="${colors.function}">${match}</span>`);
    });
    // Labels at start of line
    html = html.replace(/^([\w.]+\.)(\s+)(?=(?:An?|The)\s)/gm, (_match, p1, p2) => {
        return `${createPlaceholder(`<span class="${colors.label}">${p1}</span>`)}${p2}`;
    });
    // Shorthand labels at start of line (`name:` before `if`)
    html = html.replace(/^([\w.]+:)(\s+)(?=if\b)/gm, (_match, p1, p2) => {
        return `${createPlaceholder(`<span class="${colors.label}">${p1}</span>`)}${p2}`;
    });
    // Double asterisks (objects)
    html = html.replace(/(\*\*.+?\*\*)/g, (match) => {
        return createPlaceholder(`<span class="${colors.object}">${match}</span>`);
    });
    // Double underscores (selectors)
    html = html.replace(/(__.+?__)/g, (match) => {
        return createPlaceholder(`<span class="${colors.selector}">${match}</span>`);
    });
    // Label references (§label or $label) with optional predicates
    const predicatePattern = LABEL_PREDICATES.map((p) => p.replace(/\s+/g, "\\s+")).join("|");
    const labelWithPredicateRegex = new RegExp(`[§$]([\\w.]+)(?:\\s+(${predicatePattern}))?`, "g");
    html = html.replace(labelWithPredicateRegex, (match, labelName, _predicate) => {
        if (labeledRules.has(labelName)) {
            return createPlaceholder(`<span class="${colors.labelReference}">${match}</span>`);
        }
        return match;
    });
    // Computed value references (@name)
    html = html.replace(/@[\w.]+\b/g, (match) => {
        return createPlaceholder(`<span class="${colors.labelReference}">${match}</span>`);
    });
    // Quantifier keywords (any, all)
    html = html.replace(/\b(any|all)\b/g, (match) => {
        return createPlaceholder(`<span class="${colors.function}">${match}</span>`);
    });
    // Compound predicate keywords (where/satisfies before parenthesis)
    html = html.replace(/\b(where|satisfies)\s*(?=\()/g, (match) => {
        return createPlaceholder(`<span class="${colors.function}">${match}</span>`);
    });
    // Compound element keyword (its)
    html = html.replace(/\b(its)\b/g, (match) => {
        return createPlaceholder(`<span class="${colors.function}">${match}</span>`);
    });
    // Optional rule markers (!and, !or)
    html = html.replace(/(^|\s)(!and|!or)\b/gm, (_match, prefix, marker) => {
        return `${prefix}${createPlaceholder(`<span class="${colors.optional}">${marker}</span>`)}`;
    });
    // Computed value assignment operator
    html = html.replace(/:=/g, (match) => {
        return createPlaceholder(`<span class="${colors.function}">${match}</span>`);
    });
    // Math function names before parentheses
    html = html.replace(/\b(sqrt|min|max|clamp|floor|ceil|ceiling|round|absolute|abs)(?=\s*\()/g, (match) => {
        return createPlaceholder(`<span class="${colors.function}">${match}</span>`);
    });
    // Natural round syntax: round X to N places
    html = html.replace(/\bround\b(?=\s+(?:\x00PLACEHOLDER\d+\x00|\*\*|__|@[\w.]|\d|\())/g, (match) => {
        return createPlaceholder(`<span class="${colors.function}">${match}</span>`);
    });
    // Shorthand symbolic operators (after HTML escaping `<`/`>` are `&lt;`/`&gt;`)
    html = html.replace(/(-&gt;|&gt;=|&lt;=|==|!=|&gt;|&lt;)/g, (match) => {
        return createPlaceholder(`<span class="${colors.function}">${match}</span>`);
    });
    // Shorthand keywords (if, and, or, not)
    html = html.replace(/(?<![!])\b(if|and|or|not)\b/g, (match) => {
        return createPlaceholder(`<span class="${colors.function}">${match}</span>`);
    });
    // Dotted property paths (`user.role`, `user.address.country`).
    // Requires at least one dot between word segments and must start with a
    // letter or underscore so decimals like `1.5` are skipped.
    html = html.replace(/\b([a-zA-Z_]\w*(?:\.\w+)+)\b/g, (match) => {
        return createPlaceholder(`<span class="${colors.selector}">${match}</span>`);
    });
    // Step 6: Replace all placeholders with their actual HTML.
    // A placeholder's content can contain earlier-numbered placeholders (e.g.
    // the selector `__frequency in seconds__` wraps the placeholder created
    // for the "in" comparison phrase). Replacing in numerical order would
    // leave the inner placeholder hidden inside the outer's value when its
    // turn comes, so we iterate until every placeholder has been expanded.
    const placeholderRegex = /\x00PLACEHOLDER(\d+)\x00/g;
    let prev;
    do {
        prev = html;
        html = html.replace(placeholderRegex, (match, idxStr) => {
            const idx = Number.parseInt(idxStr, 10);
            const replacement = placeholders[idx];
            return replacement !== undefined && replacement !== ""
                ? replacement
                : match;
        });
    } while (html !== prev);
    return html;
};
