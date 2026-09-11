import DocEditor from '../../../components/DocEditor';

export default function InvoicePage({ params }) {
  return <DocEditor kind="invoice" id={params.id} />;
}
