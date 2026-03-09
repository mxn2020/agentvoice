import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useState } from 'react'
import { Shield, Server, Layers, BarChart3, Plus, Trash2, RefreshCw, Activity } from 'lucide-react'

export default function AdminPage() {
    const stats = useQuery(api.adminServices.getSystemStats)
    const tiers = useQuery(api.adminServices.listTiers)
    const providers = useQuery(api.adminServices.listProviders)
    const seedTiers = useMutation(api.adminServices.seedDefaultTiers)
    const deleteTier = useMutation(api.adminServices.deleteTier)
    const deleteProvider = useMutation(api.adminServices.deleteProvider)

    const [seeding, setSeeding] = useState(false)

    const handleSeedTiers = async () => {
        setSeeding(true)
        try {
            await seedTiers()
        } catch (err) {
            console.error('Seed error:', err)
        }
        setSeeding(false)
    }

    return (
        <div className="admin-page animate-fade-in">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                <Shield size={28} style={{ color: 'var(--color-accent)' }} />
                Admin Panel
            </h1>

            {/* ── System Stats ────────────────────────────── */}
            <div className="admin-section">
                <div className="admin-section__header">
                    <h2><BarChart3 size={20} /> System Overview</h2>
                </div>
                {stats ? (
                    <div className="dashboard-stats">
                        <div className="dashboard-stat">
                            <div className="dashboard-stat__value">{stats.totalUsers}</div>
                            <div className="dashboard-stat__label">Total Users</div>
                        </div>
                        <div className="dashboard-stat">
                            <div className="dashboard-stat__value">{stats.totalApiKeys}</div>
                            <div className="dashboard-stat__label">API Keys</div>
                        </div>
                        <div className="dashboard-stat">
                            <div className="dashboard-stat__value">{stats.totalCalls}</div>
                            <div className="dashboard-stat__label">Voice Calls</div>
                        </div>
                        <div className="dashboard-stat">
                            <div className="dashboard-stat__value">{stats.completedCalls}</div>
                            <div className="dashboard-stat__label">Completed</div>
                        </div>
                        <div className="dashboard-stat">
                            <div className="dashboard-stat__value">{stats.totalTranscriptions}</div>
                            <div className="dashboard-stat__label">Transcriptions</div>
                        </div>
                        <div className="dashboard-stat">
                            <div className="dashboard-stat__value">{stats.totalTtsJobs}</div>
                            <div className="dashboard-stat__label">TTS Jobs</div>
                        </div>
                        <div className="dashboard-stat">
                            <div className="dashboard-stat__value">{stats.pendingPayments}</div>
                            <div className="dashboard-stat__label">Pending Payments</div>
                        </div>
                    </div>
                ) : (
                    <div className="skeleton skeleton--card" style={{ height: '120px' }} />
                )}
            </div>

            {/* ── Service Tiers ────────────────────────────── */}
            <div className="admin-section">
                <div className="admin-section__header">
                    <h2><Layers size={20} /> Service Tiers</h2>
                    {(!tiers || tiers.length === 0) && (
                        <button className="btn btn--primary btn--sm" onClick={handleSeedTiers} disabled={seeding}>
                            <Plus size={14} /> {seeding ? 'Seeding...' : 'Seed Defaults'}
                        </button>
                    )}
                </div>
                {tiers && tiers.length > 0 ? (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Tier</th>
                                <th>Call $/min</th>
                                <th>Transcribe $/min</th>
                                <th>TTS $/1k chars</th>
                                <th>Max Duration</th>
                                <th>Active</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tiers.map((tier) => (
                                <tr key={tier._id}>
                                    <td>
                                        <strong>{tier.displayName}</strong>
                                        <br />
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-smoke-gray)' }}>
                                            {tier.description}
                                        </span>
                                    </td>
                                    <td>{tier.costPerMinuteCall} cr</td>
                                    <td>{tier.costPerTranscriptionMinute} cr</td>
                                    <td>{tier.costPerTtsCharacter} cr</td>
                                    <td>{tier.maxCallDurationMinutes} min</td>
                                    <td>
                                        <span className={`status-dot status-dot--${tier.isActive ? 'healthy' : 'down'}`} />
                                        {tier.isActive ? 'Yes' : 'No'}
                                    </td>
                                    <td>
                                        <button
                                            className="btn btn--danger btn--sm"
                                            onClick={() => deleteTier({ id: tier._id })}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p style={{ color: 'var(--color-smoke-gray)' }}>
                        No tiers configured. Click "Seed Defaults" to create Basic, Pro, and Premium tiers.
                    </p>
                )}
            </div>

            {/* ── Providers ───────────────────────────────── */}
            <div className="admin-section">
                <div className="admin-section__header">
                    <h2><Server size={20} /> Provider Configurations</h2>
                </div>
                {providers && providers.length > 0 ? (
                    <table className="admin-table">
                        <thead>
                            <tr>
                                <th>Provider</th>
                                <th>Type</th>
                                <th>Health</th>
                                <th>Active</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {providers.map((p) => (
                                <tr key={p._id}>
                                    <td><strong>{p.displayName}</strong></td>
                                    <td>{p.type}</td>
                                    <td>
                                        <span className={`status-dot status-dot--${p.healthStatus}`} />
                                        {p.healthStatus}
                                    </td>
                                    <td>
                                        <span className={`status-dot status-dot--${p.isActive ? 'healthy' : 'down'}`} />
                                        {p.isActive ? 'Yes' : 'No'}
                                    </td>
                                    <td>
                                        <button
                                            className="btn btn--danger btn--sm"
                                            onClick={() => deleteProvider({ id: p._id })}
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p style={{ color: 'var(--color-smoke-gray)' }}>
                        No providers configured. Seed default tiers to auto-create Deepgram, OpenAI, and ElevenLabs providers.
                    </p>
                )}
            </div>

            {/* ── MCP Server Status ───────────────────────── */}
            <div className="admin-section">
                <div className="admin-section__header">
                    <h2><Activity size={20} /> MCP Server</h2>
                    <button className="btn btn--secondary btn--sm" onClick={() => window.open('/health', '_blank')}>
                        <RefreshCw size={14} /> Health Check
                    </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-smoke-gray)', marginBottom: '4px' }}>
                            ENDPOINT
                        </div>
                        <code style={{ fontSize: '0.9rem', color: 'var(--color-accent)' }}>
                            /mcp
                        </code>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-smoke-gray)', marginBottom: '4px' }}>
                            TRANSPORT
                        </div>
                        <span style={{ fontSize: '0.9rem' }}>Streamable HTTP (JSON-RPC 2.0)</span>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-smoke-gray)', marginBottom: '4px' }}>
                            TOOLS
                        </div>
                        <span style={{ fontSize: '0.9rem' }}>14 tools</span>
                    </div>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-smoke-gray)', marginBottom: '4px' }}>
                            AUTH
                        </div>
                        <span style={{ fontSize: '0.9rem' }}>Bearer API Key (SHA-256)</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
