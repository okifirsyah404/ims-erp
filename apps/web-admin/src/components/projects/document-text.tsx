import { Fragment } from 'react';

import { parseTerms } from '@/lib/document-terms';

/** Renders `**…**` as bold, the rest as text. */
export function RichText({ text }: { text: string }) {
	const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
	return (
		<>
			{parts.map((part, index) =>
				part.startsWith('**') && part.endsWith('**') ? <strong key={index}>{part.slice(2, -2)}</strong> : <Fragment key={index}>{part}</Fragment>,
			)}
		</>
	);
}

/** Numbered terms with "o" sub-bullets, as in the warranty sample. */
export function TermList({ text, className }: { text: string; className?: string }) {
	return (
		<ol className={`list-decimal pl-[13mm] ${className ?? ''}`}>
			{parseTerms(text).map((term, index) => (
				<li key={index}>
					<RichText text={term.text} />
					{term.children.length > 0 && (
						<ul className='pl-[8mm]'>
							{term.children.map((child, at) => (
								<li key={at} className='flex gap-[4mm]'>
									<span>o</span>
									<span>
										<RichText text={child} />
									</span>
								</li>
							))}
						</ul>
					)}
				</li>
			))}
		</ol>
	);
}
