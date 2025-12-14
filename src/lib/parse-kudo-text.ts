import type { ElementContent, Root, RootContent, Text } from "hast";
import rehypeParse from "rehype-parse";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { unified } from "unified";

export const rehypeKudo = () => {
    function parse(node: RootContent): ElementContent {
        switch (node.type) {
            case 'element':
                if (node.tagName === 'img') {
                    return {
                        type: 'text',
                        value: node.properties['alt'] || ''
                    } as Text
                }
                node.children = node.children.map(parse)
            default:
                return node as ElementContent
        }
    }
    return (tree: Root) => {
        tree.children = tree.children.map(parse)
        return tree
    }
}

export function parseHtml(string: string) {
    return unified()
        .use(rehypeParse, { fragment: true })
        .use(rehypeKudo)
        .use(rehypeSanitize)
        .use(rehypeStringify)
        .processSync(string)
        .value
        .toString()
}