import { useState } from 'react'
import { Phone, Mic, Volume2, Download, Zap, Shield, CreditCard, Bot, ChevronDown, ArrowRight, Sparkles, Globe } from 'lucide-react'

const TIERS = [
    {
        name: 'Basic',
        badge: null,
        description: 'Good quality at an affordable rate.',
        callCost: '2 credits/min',
        transcriptionCost: '1 credit/min',
        ttsCost: '1 credit/1k chars',
        features: ['Call recording', 'Full transcript', 'Up to 10 min calls'],
        accent: 'var(--color-neon-emerald)',
    },
    {
        name: 'Pro',
        badge: 'Popular',
        description: 'HD voice with smart features.',
        callCost: '5 credits/min',
        transcriptionCost: '2 credits/min',
        ttsCost: '3 credits/1k chars',
        features: ['HD voice quality', 'AI call summary', 'Up to 30 min calls', 'All Basic features'],
        accent: 'var(--color-accent)',
    },
    {
        name: 'Premium',
        badge: 'Best Quality',
        description: 'ElevenLabs voices, custom cloning.',
        callCost: '12 credits/min',
        transcriptionCost: '3 credits/min',
        ttsCost: '5 credits/1k chars',
        features: ['ElevenLabs voices', 'Custom voice cloning', 'Up to 60 min calls', 'Priority processing', 'All Pro features'],
        accent: 'var(--color-warm-amber)',
    },
]

const CREDIT_PACKAGES = [
    { name: 'Starter', credits: 100, price: '$5', perCredit: '$0.050' },
    { name: 'Standard', credits: 500, price: '$20', perCredit: '$0.040' },
    { name: 'Pro', credits: '2,000', price: '$70', perCredit: '$0.035' },
    { name: 'Enterprise', credits: '10,000', price: '$300', perCredit: '$0.030' },
]

const STEPS = [
    {
        icon: <Download size={28} />,
        title: 'Download Skill',
        description: 'Add the AgentVoice MCP skill to your AI system (Claude, GPT, custom agents).',
    },
    {
        icon: <Bot size={28} />,
        title: 'Agent Sets Up',
        description: 'Your AI agent creates an account, purchases credits with crypto, and configures services.',
    },
    {
        icon: <Phone size={28} />,
        title: 'Agent Uses Services',
        description: 'Initiate calls, transcribe audio, generate speech — all through MCP tools.',
    },
]

export default function LandingPage() {
    const [openFaq, setOpenFaq] = useState<number | null>(null)
    const [skillCopied, setSkillCopied] = useState(false)

    const handleDownloadSkill = () => {
        const link = document.createElement('a')
        link.href = '/agentvoice-skill.json'
        link.download = 'agentvoice-skill.json'
        link.click()
    }

    const handleCopyMcpUrl = () => {
        navigator.clipboard.writeText('https://agentvoice.app/mcp')
        setSkillCopied(true)
        setTimeout(() => setSkillCopied(false), 2000)
    }

    const faqs = [
        {
            q: 'What is AgentVoice?',
            a: 'AgentVoice is an MCP server that provides AI voice call, transcription, and text-to-speech services to AI agents. Your AI agent handles everything — account setup, credit purchases, and service usage — through MCP tools.',
        },
        {
            q: 'How do payments work?',
            a: 'AgentVoice uses a credit-based system with crypto payments. Your agent purchases credit packages (starting at $5 for 100 credits) and credits are deducted per service usage. No subscriptions, no recurring charges.',
        },
        {
            q: 'Which AI systems are supported?',
            a: 'Any AI system that supports MCP (Model Context Protocol): Claude Desktop, custom AI agents, and any system that can make HTTP requests to MCP servers.',
        },
        {
            q: 'What are the service tiers?',
            a: 'Three tiers: Basic (Deepgram, affordable), Pro (OpenAI Realtime, HD quality), Premium (ElevenLabs, best quality + voice cloning). Each tier has different credit costs.',
        },
        {
            q: 'Do I need a web account?',
            a: 'No. Your AI agent creates an account through the MCP tools. If you need a dashboard, your agent can generate an access token for you to view usage and logs.',
        },
    ]

    return (
        <div className="landing-page">
            {/* ── Hero ────────────────────────────────────── */}
            <section className="landing-hero">
                <div className="landing-hero__content">
                    <div className="landing-hero__badge">
                        <Bot size={14} />
                        <span>Built for AI Agents</span>
                    </div>
                    <h1 className="landing-hero__title">
                        Voice & Audio Services<br />
                        <span className="landing-hero__title-accent">for AI Agents</span>
                    </h1>
                    <p className="landing-hero__tagline">
                        Real-time voice calls, transcription, and text-to-speech — all accessible
                        through MCP tools. Your AI agent handles setup, payments, and usage.
                        No human interface needed.
                    </p>
                    <div className="landing-hero__actions">
                        <button className="btn btn--primary btn--lg" onClick={handleDownloadSkill}>
                            <Download size={20} />
                            Download Skill
                        </button>
                        <button className="btn btn--secondary btn--lg" onClick={handleCopyMcpUrl}>
                            <Globe size={20} />
                            {skillCopied ? 'Copied!' : 'Copy MCP URL'}
                        </button>
                    </div>
                    <p className="landing-hero__subtext">
                        Add to Claude Desktop, GPT, or any MCP-compatible agent
                    </p>
                </div>
            </section>

            {/* ── Services ────────────────────────────────── */}
            <section className="landing-features">
                <h2 className="landing-section__title">Three Powerful Services</h2>
                <div className="landing-features__grid">
                    <div className="landing-feature">
                        <div className="landing-feature__icon" style={{ color: 'var(--color-accent)' }}>
                            <Phone size={36} />
                        </div>
                        <h3>AI Voice Calls</h3>
                        <p>
                            Initiate real-time AI voice conversations. Get full transcripts,
                            recordings, and AI-generated summaries of every call.
                        </p>
                    </div>
                    <div className="landing-feature">
                        <div className="landing-feature__icon" style={{ color: 'var(--color-neon-emerald)' }}>
                            <Mic size={36} />
                        </div>
                        <h3>Transcription</h3>
                        <p>
                            Convert audio files to text with high accuracy. Multiple languages
                            supported with timestamped segments.
                        </p>
                    </div>
                    <div className="landing-feature">
                        <div className="landing-feature__icon" style={{ color: 'var(--color-warm-amber)' }}>
                            <Volume2 size={36} />
                        </div>
                        <h3>Text-to-Speech</h3>
                        <p>
                            Generate natural-sounding audio from text. Choose from multiple
                            voices and quality tiers including ElevenLabs.
                        </p>
                    </div>
                </div>
            </section>

            {/* ── How It Works ────────────────────────────── */}
            <section className="landing-features">
                <h2 className="landing-section__title">How It Works</h2>
                <div className="landing-steps">
                    {STEPS.map((step, i) => (
                        <div key={i} className="landing-step">
                            <div className="landing-step__number">{i + 1}</div>
                            <div className="landing-step__icon">{step.icon}</div>
                            <h3>{step.title}</h3>
                            <p>{step.description}</p>
                            {i < STEPS.length - 1 && (
                                <div className="landing-step__arrow">
                                    <ArrowRight size={20} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Pricing Tiers ───────────────────────────── */}
            <section className="landing-features" id="pricing">
                <h2 className="landing-section__title">Service Tiers</h2>
                <p className="landing-section__subtitle">
                    Choose quality and cost per service. All tiers available on every credit package.
                </p>
                <div className="pricing-grid">
                    {TIERS.map((tier) => (
                        <div
                            key={tier.name}
                            className={`pricing-card ${tier.badge === 'Popular' ? 'pricing-card--popular' : ''}`}
                        >
                            {tier.badge && <div className="pricing-card__badge">{tier.badge}</div>}
                            <div className="pricing-card__header">
                                <h3>{tier.name}</h3>
                                <p className="pricing-card__desc">{tier.description}</p>
                            </div>
                            <div className="pricing-card__costs">
                                <div className="pricing-card__cost-row">
                                    <Phone size={16} /> <span>Calls: {tier.callCost}</span>
                                </div>
                                <div className="pricing-card__cost-row">
                                    <Mic size={16} /> <span>Transcription: {tier.transcriptionCost}</span>
                                </div>
                                <div className="pricing-card__cost-row">
                                    <Volume2 size={16} /> <span>TTS: {tier.ttsCost}</span>
                                </div>
                            </div>
                            <ul className="pricing-card__features">
                                {tier.features.map((f) => (
                                    <li key={f}>
                                        <Sparkles size={14} style={{ color: tier.accent }} /> {f}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Credit Packages ─────────────────────────── */}
            <section className="landing-features">
                <h2 className="landing-section__title">Credit Packages</h2>
                <p className="landing-section__subtitle">
                    Pay with crypto. No subscriptions. Credits never expire.
                </p>
                <div className="landing-packages">
                    {CREDIT_PACKAGES.map((pkg) => (
                        <div key={pkg.name} className="landing-package">
                            <div className="landing-package__name">{pkg.name}</div>
                            <div className="landing-package__credits">{pkg.credits} credits</div>
                            <div className="landing-package__price">{pkg.price}</div>
                            <div className="landing-package__per">{pkg.perCredit}/credit</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Features Grid ───────────────────────────── */}
            <section className="landing-features">
                <h2 className="landing-section__title">Built for Agents</h2>
                <div className="landing-features__grid">
                    <div className="landing-feature">
                        <CreditCard size={28} style={{ color: 'var(--color-accent)' }} />
                        <h3>Crypto Payments</h3>
                        <p>BTC, ETH, USDC — your agent buys credits programmatically. No credit cards needed.</p>
                    </div>
                    <div className="landing-feature">
                        <Shield size={28} style={{ color: 'var(--color-neon-emerald)' }} />
                        <h3>API Key Auth</h3>
                        <p>Secure API key authentication. One key for all services.</p>
                    </div>
                    <div className="landing-feature">
                        <Zap size={28} style={{ color: 'var(--color-warm-amber)' }} />
                        <h3>14 MCP Tools</h3>
                        <p>Full account management, billing, and service usage through standardized MCP tools.</p>
                    </div>
                </div>
            </section>

            {/* ── FAQ ─────────────────────────────────────── */}
            <section className="landing-features">
                <h2 className="landing-section__title">FAQ</h2>
                <div className="faq-list">
                    {faqs.map((faq, i) => (
                        <div
                            key={i}
                            className={`faq-item ${openFaq === i ? 'faq-item--open' : ''}`}
                            onClick={() => setOpenFaq(openFaq === i ? null : i)}
                        >
                            <div className="faq-item__question">
                                {faq.q}
                                <ChevronDown
                                    size={18}
                                    className="faq-item__icon"
                                    style={{
                                        transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0)',
                                        transition: 'transform 0.2s',
                                    }}
                                />
                            </div>
                            {openFaq === i && <div className="faq-item__answer">{faq.a}</div>}
                        </div>
                    ))}
                </div>
            </section>

            {/* ── CTA ─────────────────────────────────────── */}
            <section className="landing-cta">
                <h2>Ready to give your agent a voice?</h2>
                <p>Download the skill, let your agent do the rest.</p>
                <button className="btn btn--primary btn--lg" onClick={handleDownloadSkill}>
                    <Download size={20} />
                    Download AgentVoice Skill
                </button>
            </section>
        </div>
    )
}
