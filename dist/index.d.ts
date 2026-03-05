export interface ColorMap {
    number: string;
    date: string;
    object: string;
    comment: string;
    selector: string;
    function: string;
    reference: string;
    referenced: string;
    label: string;
    labelReference: string;
    false: string;
    true: string;
    string: string;
    optional: string;
}
export declare const highlightText: (text: string, colors: ColorMap) => string;
