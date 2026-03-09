import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { CreditCard, Phone, Mic, Volume2, Clock, ArrowUpRight, ArrowDownRight, Key } from 'lucide-react'

export default function DashboardPage() {
    const balance = useQuery(api.credits.getBalance)
    const transactions = useQuery(api.credits.getTransactionHistory, { limit: 20 })

    if (!balance) {
        return (
            <div className="dashboard-page animate-fade-in">
                <h1 style={{ marginBottom: '32px' }}>Dashboard</h1>
                <div className="skeleton skeleton--card" style={{ height: '200px' }} />
            </div>
        )
    }

    return (
        <div className="dashboard-page animate-fade-in">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                <CreditCard size={28} style={{ color: 'var(--color-accent)' }} />
                Account Dashboard
            </h1>

            {/* ── Balance Stats ────────────────────────────── */}
            <div className="dashboard-stats">
                <div className="dashboard-stat">
                    <div className="dashboard-stat__value">{balance.balance.toLocaleString()}</div>
                    <div className="dashboard-stat__label">Available Credits</div>
                </div>
                <div className="dashboard-stat">
                    <div className="dashboard-stat__value" style={{ color: 'var(--color-neon-emerald)' }}>
                        {balance.totalPurchased.toLocaleString()}
                    </div>
                    <div className="dashboard-stat__label">Total Purchased</div>
                </div>
                <div className="dashboard-stat">
                    <div className="dashboard-stat__value" style={{ color: 'var(--color-warm-amber)' }}>
                        {balance.totalUsed.toLocaleString()}
                    </div>
                    <div className="dashboard-stat__label">Total Used</div>
                </div>
            </div>

            {/* ── Transaction History ─────────────────────── */}
            <div className="dashboard-section">
                <div className="dashboard-section__header">
                    <h2><Clock size={20} /> Transaction History</h2>
                </div>
                {transactions && transactions.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {transactions.map((tx) => (
                            <div key={tx._id} className="admin-section" style={{ padding: '16px 20px', marginBottom: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: tx.amount > 0
                                                ? 'rgba(16, 185, 129, 0.15)'
                                                : 'rgba(245, 158, 11, 0.15)',
                                        }}>
                                            {tx.amount > 0
                                                ? <ArrowUpRight size={18} style={{ color: 'var(--color-neon-emerald)' }} />
                                                : getServiceIcon(tx.description)
                                            }
                                        </div>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{tx.description}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-smoke-gray)' }}>
                                                {new Date(tx.createdAt).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{
                                        fontFamily: 'var(--font-heading)',
                                        fontWeight: 700,
                                        fontSize: '1.1rem',
                                        color: tx.amount > 0 ? 'var(--color-neon-emerald)' : 'var(--color-warm-amber)',
                                    }}>
                                        {tx.amount > 0 ? '+' : ''}{tx.amount}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="admin-section" style={{ textAlign: 'center', padding: '48px' }}>
                        <CreditCard size={40} style={{ color: 'var(--color-smoke-gray)', marginBottom: '16px' }} />
                        <p style={{ color: 'var(--color-smoke-gray)' }}>No transactions yet.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

function getServiceIcon(description: string) {
    if (description.toLowerCase().includes('voice') || description.toLowerCase().includes('call')) {
        return <Phone size={18} style={{ color: 'var(--color-warm-amber)' }} />
    }
    if (description.toLowerCase().includes('transcript')) {
        return <Mic size={18} style={{ color: 'var(--color-warm-amber)' }} />
    }
    if (description.toLowerCase().includes('tts')) {
        return <Volume2 size={18} style={{ color: 'var(--color-warm-amber)' }} />
    }
    return <ArrowDownRight size={18} style={{ color: 'var(--color-warm-amber)' }} />
}
