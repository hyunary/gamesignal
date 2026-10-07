import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

const mdComponents: Components = {
  table: ({ children }) => (
    <div className="nc-table-scroll">
      <table>{children}</table>
    </div>
  ),
};

const remarkPlugins = [
  [remarkGfm, { singleTilde: false }],
] as Parameters<typeof ReactMarkdown>[0]['remarkPlugins'];

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="nc-md">
      <ReactMarkdown remarkPlugins={remarkPlugins} components={mdComponents}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
