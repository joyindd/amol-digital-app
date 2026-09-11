import DocEditor from '../../../components/DocEditor';

export default function QuotationPage({ params }) {
  return <DocEditor kind="quotation" id={params.id} />;
}
