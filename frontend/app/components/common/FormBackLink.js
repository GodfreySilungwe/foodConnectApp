import Link from 'next/link';

export default function FormBackLink({ href = '/', label = 'Home' }) {
  return <Link href={href} className="form-back-link"><span aria-hidden="true">←</span>{label}</Link>;
}