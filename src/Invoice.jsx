import { useRef } from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export default function Invoice({ order }) {
  const invoiceRef = useRef();

  const downloadPDF = async () => {
    const canvas = await html2canvas(invoiceRef.current);
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 190;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
    pdf.save(`Invoice-${order.id}.pdf`);
  };

  return (
    <div>
      <div
        ref={invoiceRef}
        style={{
          padding: '30px',
          background: 'white',
          width: '600px',
        }}
      >
        <h2>URJA FARMS</h2>
        <p>Agri Wholesale Business</p>
        <hr />

        <h3>Invoice</h3>
        <p>
          <strong>Invoice ID:</strong> {order.id}
        </p>
        <p>
          <strong>Buyer:</strong> {order.buyer_name}
        </p>
        <p>
          <strong>Product:</strong> {order.product_name}
        </p>
        <p>
          <strong>Quantity:</strong> {order.quantity} kg
        </p>
        <p>
          <strong>Price per kg:</strong> ₹{order.price}
        </p>
        <p>
          <strong>Total:</strong> ₹{order.total_amount}
        </p>
        <p>
          <strong>Status:</strong> {order.payment_status}
        </p>

        <hr />
        <p>Thank you for doing business with us.</p>
      </div>

      <button onClick={downloadPDF}>Download Invoice PDF</button>
    </div>
  );
}
