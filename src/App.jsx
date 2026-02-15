import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { Routes, Route, useParams, useNavigate } from 'react-router-dom';
import { QRCodeCanvas } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/* ================= ROUTER ================= */

function App() {
  return (
    <Routes>
      <Route path="/" element={<AdminApp />} />
      <Route path="/pay/:invoice" element={<PaymentPage />} />
      <Route path="/invoice/:invoice" element={<InvoicePage />} />
    </Routes>
  );
}

/* ================= ADMIN ================= */

function AdminApp() {
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [products, setProducts] = useState([]);
  const [buyers, setBuyers] = useState([]);
  const [orders, setOrders] = useState([]);

  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedBuyer, setSelectedBuyer] = useState('');
  const [quantity, setQuantity] = useState('');

  const [selectedBuyerFilter, setSelectedBuyerFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showLedger, setShowLedger] = useState(false);

  /* ================= AUTH ================= */

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
  }, []);

  async function login() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) alert(error.message);
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  /* ================= FETCH DATA ================= */

  useEffect(() => {
    if (session) {
      fetchProducts();
      fetchBuyers();
      fetchOrders();
    }
  }, [session]);

  async function fetchProducts() {
    const { data } = await supabase.from('products').select('*');
    setProducts(data || []);
  }

  async function fetchBuyers() {
    const { data } = await supabase.from('buyers').select('*');
    setBuyers(data || []);
  }

  async function fetchOrders() {
    const { data } = await supabase
      .from('orders')
      .select('*, products(name), buyers(name)')
      .order('created_at', { ascending: false });

    setOrders(data || []);
  }

  /* ================= CREATE ORDER ================= */

  async function createOrder() {
    if (!selectedProduct || !selectedBuyer || !quantity) {
      alert('Fill all fields');
      return;
    }

    const product = products.find((p) => p.id === selectedProduct);
    const totalAmount = Number(quantity) * product.price_per_kg;
    const invoice = 'INV-' + Date.now();

    await supabase.from('orders').insert([
      {
        buyer_id: selectedBuyer,
        product_id: selectedProduct,
        quantity: Number(quantity),
        total_amount: totalAmount,
        amount_paid: 0,
        invoice_number: invoice,
      },
    ]);

    await supabase
      .from('products')
      .update({
        quantity_available: product.quantity_available - Number(quantity),
      })
      .eq('id', selectedProduct);

    fetchOrders();
    fetchProducts();

    const link = `${window.location.origin}/pay/${invoice}`;
    await navigator.clipboard.writeText(link);
    alert('Payment link copied!');
  }

  if (!session) {
    return (
      <div className="dashboard-container">
        <h2>Admin Login</h2>
        <input type="email" onChange={(e) => setEmail(e.target.value)} />
        <input type="password" onChange={(e) => setPassword(e.target.value)} />
        <button onClick={login}>Login</button>
      </div>
    );
  }

  /* ================= FILTERING ================= */

  let filteredOrders = [...orders];

  if (selectedBuyerFilter) {
    filteredOrders = filteredOrders.filter(
      (o) => o.buyers?.name === selectedBuyerFilter
    );
  }

  if (statusFilter !== 'all') {
    filteredOrders = filteredOrders.filter((o) => {
      const due = o.total_amount - (o.amount_paid || 0);
      if (statusFilter === 'unpaid') return o.amount_paid === 0;
      if (statusFilter === 'partial') return o.amount_paid > 0 && due > 0;
      if (statusFilter === 'paid') return due <= 0;
      return true;
    });
  }

  if (dateFilter !== 'all') {
    const now = new Date();
    filteredOrders = filteredOrders.filter((o) => {
      const d = new Date(o.created_at);

      if (dateFilter === 'thisMonth') {
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      }

      if (dateFilter === 'lastMonth') {
        const last = new Date(now.getFullYear(), now.getMonth() - 1);
        return (
          d.getMonth() === last.getMonth() &&
          d.getFullYear() === last.getFullYear()
        );
      }

      return true;
    });
  }

  if (searchTerm.trim()) {
    filteredOrders = filteredOrders.filter(
      (o) =>
        o.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.buyers?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  const totalSales = filteredOrders.reduce((sum, o) => sum + o.total_amount, 0);
  const totalCollected = filteredOrders.reduce(
    (sum, o) => sum + (o.amount_paid || 0),
    0
  );
  const totalOutstanding = totalSales - totalCollected;

  /* ================= UI ================= */

  return (
    <div className="dashboard-container">
      <h1>🌾 URJA FARMS</h1>
      <button className="button-danger" onClick={logout}>
        Logout
      </button>

      {/* SUMMARY CARDS */}
      <div className="card-row" style={{ marginTop: 20 }}>
        <div className="card">
          <h3>Total Sales</h3>
          <p>₹{totalSales}</p>
        </div>
        <div className="card">
          <h3>Total Collected</h3>
          <p>₹{totalCollected}</p>
        </div>
        <div className="card">
          <h3>Total Outstanding</h3>
          <p>₹{totalOutstanding}</p>
        </div>
      </div>

      {/* CREATE ORDER CARD */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3>Create Order</h3>
        <select onChange={(e) => setSelectedBuyer(e.target.value)}>
          <option value="">Select Buyer</option>
          {buyers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select onChange={(e) => setSelectedProduct(e.target.value)}>
          <option value="">Select Product</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} (₹{p.price_per_kg}/kg)
            </option>
          ))}
        </select>

        <input
          placeholder="Quantity (kg)"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />

        <button className="button-primary" onClick={createOrder}>
          Create Order
        </button>
      </div>

      {/* FILTERS */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3>Filters</h3>

        <input
          placeholder="Search buyer or invoice"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div style={{ marginTop: 10 }}>
          <button onClick={() => setStatusFilter('all')}>All</button>
          <button onClick={() => setStatusFilter('unpaid')}>Unpaid</button>
          <button onClick={() => setStatusFilter('partial')}>Partial</button>
          <button onClick={() => setStatusFilter('paid')}>Paid</button>
        </div>

        <div style={{ marginTop: 10 }}>
          <button onClick={() => setDateFilter('all')}>All Time</button>
          <button onClick={() => setDateFilter('thisMonth')}>This Month</button>
          <button onClick={() => setDateFilter('lastMonth')}>Last Month</button>
        </div>
      </div>

      {/* ORDERS */}
      <div className="card-row" style={{ marginTop: 20 }}>
        {filteredOrders.map((o) => {
          const due = o.total_amount - (o.amount_paid || 0);

          return (
            <div key={o.id} className="card">
              <strong>{o.products?.name}</strong>
              <p>Date: {new Date(o.created_at).toLocaleDateString()}</p>
              <p>Buyer: {o.buyers?.name}</p>
              <p>Total: ₹{o.total_amount}</p>
              <p>Paid: ₹{o.amount_paid || 0}</p>
              <p>Due: ₹{due}</p>

              {due > 0 && (
                <>
                  <button
                    className="button-secondary"
                    onClick={async () => {
                      const payment = prompt('Enter payment amount:');
                      if (!payment) return;

                      await supabase
                        .from('orders')
                        .update({
                          amount_paid:
                            Number(o.amount_paid || 0) + Number(payment),
                        })
                        .eq('id', o.id);

                      fetchOrders();

                      const link = `${window.location.origin}/pay/${o.invoice_number}`;
                      await navigator.clipboard.writeText(link);
                      alert('Updated payment link copied!');
                    }}
                  >
                    Add Payment
                  </button>

                  <button
                    className="button-secondary"
                    onClick={async () => {
                      const link = `${window.location.origin}/pay/${o.invoice_number}`;
                      await navigator.clipboard.writeText(link);
                      alert('Payment link copied!');
                    }}
                  >
                    Copy Payment Link
                  </button>
                </>
              )}

              <button
                className="button-primary"
                onClick={() => navigate(`/invoice/${o.invoice_number}`)}
              >
                View Invoice
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ================= PAYMENT PAGE ================= */

function PaymentPage() {
  const { invoice } = useParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    supabase
      .from('orders')
      .select('*, products(name)')
      .eq('invoice_number', invoice)
      .single()
      .then(({ data }) => setOrder(data));
  }, []);

  if (!order) return <h2>Loading...</h2>;

  const due = order.total_amount - (order.amount_paid || 0);

  const upiLink = `upi://pay?pa=jaturvashi123-2@oksbi&pn=URJA FARMS&am=${due}&cu=INR`;

  return (
    <div className="dashboard-container">
      <div className="card">
        <h2>URJA FARMS Payment</h2>
        <p>Invoice: {order.invoice_number}</p>
        <p>Due Amount: ₹{due}</p>

        {due > 0 ? (
          <>
            <a href={upiLink} className="button-primary">
              Pay via UPI
            </a>
            <br />
            <br />
            <QRCodeCanvas value={upiLink} size={200} />
          </>
        ) : (
          <h3 style={{ color: 'green' }}>Payment Completed ✅</h3>
        )}
      </div>
    </div>
  );
}

/* ================= INVOICE PAGE ================= */

function InvoicePage() {
  const { invoice } = useParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    supabase
      .from('orders')
      .select('*, buyers(name), products(name)')
      .eq('invoice_number', invoice)
      .single()
      .then(({ data }) => setOrder(data));
  }, []);

  const downloadPDF = async () => {
    const input = document.getElementById('invoice-content');
    const canvas = await html2canvas(input);
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF();
    pdf.addImage(imgData, 'PNG', 10, 10, 180, 0);
    pdf.save(`Invoice-${invoice}.pdf`);
  };

  if (!order) return <h2>Loading...</h2>;

  const due = order.total_amount - (order.amount_paid || 0);

  return (
    <div className="dashboard-container">
      <div id="invoice-content" className="card">
        <h2>URJA FARMS</h2>
        <p>Date: {new Date(order.created_at).toLocaleDateString()}</p>
        <p>Invoice: {order.invoice_number}</p>
        <p>Buyer: {order.buyers?.name}</p>
        <p>Product: {order.products?.name}</p>
        <p>Total: ₹{order.total_amount}</p>
        <p>Paid: ₹{order.amount_paid || 0}</p>
        <p>Due: ₹{due}</p>
      </div>

      <button className="button-primary" onClick={downloadPDF}>
        Download Invoice PDF
      </button>
    </div>
  );
}

export default App;
