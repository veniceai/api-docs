// The web search guide's side by side: one benchmark question, what Brave,
// Google and Exa returned for it, and whether the answer written from those
// results was right. The questions are a fixed excerpt of the October 30,
// 2026 run of the search provider benchmark, so the page shows real results
// without making a request.
//
// Snippet exports are evaluated in isolation, so everything lives inside the
// component.
export const SearchCompare = () => {
  const QUESTIONS = [
    {
      "label": "FastAPI release",
      "question": "Which FastAPI version first let one endpoint use more than one Pydantic model for its query parameters (or for its headers or cookies), or mix such a model with individual parameters?",
      "gold": "FastAPI 0.157.0",
      "source": "github.com",
      "providers": [
        {
          "name": "Brave",
          "verdict": "wrong",
          "seconds": 1.15,
          "tokens": 4388,
          "answer": "Based on the sources provided, the ability to use Pydantic models for query, header, and cookie parameters was first introduced in FastAPI version 0.115.0.",
          "hits": [
            {
              "title": "Query Parameter Models - FastAPI",
              "domain": "fastapi.tiangolo.com",
              "relevance": 3,
              "official": false
            },
            {
              "title": "✨ Support for mixed and multiple Pydantic models for parameters using Query, Cookie and Header by JSCU-CNI · Pull Request #12481 · fastapi/fastapi · GitHub",
              "domain": "github.com",
              "relevance": 1,
              "official": false
            },
            {
              "title": "Can I use more than 1 Query Parameter Model · fastapi/fastapi · Discussion #13566 · GitHub",
              "domain": "github.com",
              "relevance": 1,
              "official": false
            },
            {
              "title": "The evolution of FastAPI — Pydantic models for Query, Header, and Cookie parameters | UnfoldAI",
              "domain": "unfoldai.com",
              "relevance": 2,
              "official": false
            }
          ]
        },
        {
          "name": "Google",
          "verdict": "wrong",
          "seconds": 4.64,
          "tokens": 19650,
          "answer": "Based on the provided sources, FastAPI version 0.115.0 is the version that first allowed endpoints to use Pydantic models for query parameters (as well as for headers…",
          "hits": [
            {
              "title": "Query Parameter Models",
              "domain": "fastapi.tiangolo.com",
              "relevance": 2,
              "official": false
            },
            {
              "title": "How to define query parameters using Pydantic model in ...",
              "domain": "stackoverflow.com",
              "relevance": 1,
              "official": false
            },
            {
              "title": "Body - Multiple Parameters",
              "domain": "fastapi.tiangolo.com",
              "relevance": 0,
              "official": false
            },
            {
              "title": "Support multiple Query() in a single endpoint #12212",
              "domain": "google.com",
              "relevance": 2,
              "official": false
            }
          ]
        },
        {
          "name": "Exa",
          "verdict": "correct",
          "seconds": 0.68,
          "tokens": 4068,
          "answer": "Based on the sources, the ability to use more than one Pydantic model for query, header, or cookie parameters in a single endpoint—or to mix such models with individual…",
          "hits": [
            {
              "title": "0.115.0",
              "domain": "github.com",
              "relevance": 1,
              "official": false
            },
            {
              "title": "55035f4 ✨ Add support for Pydantic models for parameters using `Query`, `Cookie`, `Header` (#12199)",
              "domain": "github.com",
              "relevance": 1,
              "official": false
            },
            {
              "title": "✨ Support for mixed and multiple Pydantic models for parameters using Query, Cookie and Header",
              "domain": "github.com",
              "relevance": 2,
              "official": false
            },
            {
              "title": "Cookie Parameter Models - FastAPI",
              "domain": "fastapi.tiangolo.com",
              "relevance": 2,
              "official": false
            }
          ]
        }
      ]
    },
    {
      "label": "Venice x402",
      "question": "Which blockchains can I use to pay for the Venice API with x402?",
      "gold": "Base or Solana, paying with USDC",
      "source": "docs.venice.ai",
      "providers": [
        {
          "name": "Brave",
          "verdict": "correct",
          "seconds": 1.05,
          "tokens": 3782,
          "answer": "You can pay for the Venice API with x402 using USDC on Base or Solana.",
          "hits": [
            {
              "title": "X402 - Venice API",
              "domain": "docs.venice.ai",
              "relevance": 3,
              "official": true
            },
            {
              "title": "x402 is Live on Venice — the Internet-Native Payment Standard for Agentic Commerce",
              "domain": "venice.ai",
              "relevance": 2,
              "official": false
            },
            {
              "title": "Pay for Venice.ai with Crypto: BTC, USDC, VVV or a Card | SolCard Blog",
              "domain": "solcard.cc",
              "relevance": 3,
              "official": false
            },
            {
              "title": "Venice AI Explained: Private AI, DIEM & VVV Tokenomics",
              "domain": "datawallet.com",
              "relevance": 3,
              "official": false
            }
          ]
        },
        {
          "name": "Google",
          "verdict": "wrong",
          "seconds": 5.79,
          "tokens": 18104,
          "answer": "Based on the sources provided, you can use Base to pay for the Venice API with x402.",
          "hits": [
            {
              "title": "x402 Protocol Explained: How AI Agents Pay Onchain | Support",
              "domain": "eco.com",
              "relevance": 1,
              "official": false
            },
            {
              "title": "Venice AI Plugin - Coinbase Developer Documentation",
              "domain": "docs.cdp.coinbase.com",
              "relevance": 3,
              "official": false
            },
            {
              "title": "x402",
              "domain": "x402.org",
              "relevance": 1,
              "official": false
            },
            {
              "title": "What Is x402? The Payment Protocol for AI Agents and ...",
              "domain": "google.com",
              "relevance": 1,
              "official": false
            }
          ]
        },
        {
          "name": "Exa",
          "verdict": "correct",
          "seconds": 0.7,
          "tokens": 11345,
          "answer": "You can pay for the Venice API with x402 using USDC on Base (mainnet) or Solana (mainnet).",
          "hits": [
            {
              "title": "docs.venice.ai",
              "domain": "docs.venice.ai",
              "relevance": 3,
              "official": true
            },
            {
              "title": "X402 Top Up | Venice API Docs",
              "domain": "docs.venice.ai",
              "relevance": 3,
              "official": false
            },
            {
              "title": "swagger.yaml",
              "domain": "github.com",
              "relevance": 3,
              "official": false
            },
            {
              "title": "skills/venice-auth/SKILL.md",
              "domain": "github.com",
              "relevance": 3,
              "official": false
            }
          ]
        }
      ]
    },
    {
      "label": "Linear rate limit",
      "question": "How many requests per hour can I make to Linear's GraphQL API with an API key?",
      "gold": "2,500 requests per hour per user, shared across all of that user's API keys (OAuth apps get 5,000 per hour)",
      "source": "linear.app",
      "providers": [
        {
          "name": "Brave",
          "verdict": "wrong",
          "seconds": 0.76,
          "tokens": 2639,
          "answer": "The sources provide conflicting information about the request limits for Linear's GraphQL API when using an API key: * 1,500 requests per hour: Multiple sources state…",
          "hits": [
            {
              "title": "Rate limiting – Linear Developers",
              "domain": "linear.app",
              "relevance": 3,
              "official": true
            },
            {
              "title": "Linear API Essential Guide - Rollout",
              "domain": "rollout.com",
              "relevance": 2,
              "official": false
            },
            {
              "title": "Linear API | API Explorer",
              "domain": "requestly.com",
              "relevance": 2,
              "official": false
            },
            {
              "title": "linear: Manage Linear issues, projects, and teams via the GraphQL API using curl | skills.rest",
              "domain": "skills.rest",
              "relevance": 2,
              "official": false
            }
          ]
        },
        {
          "name": "Google",
          "verdict": "correct",
          "seconds": 3.45,
          "tokens": 15182,
          "answer": "You can make up to 2,500 requests per hour to Linear's GraphQL API when authenticated with an API key.",
          "hits": [
            {
              "title": "Linear API Key: How to Generate and Use It (GraphQL Guide",
              "domain": "unified.to",
              "relevance": 2,
              "official": false
            },
            {
              "title": "Rate limiting – Linear Developers",
              "domain": "linear.app",
              "relevance": 3,
              "official": true
            },
            {
              "title": "How to get your API key in Linear (5 steps)",
              "domain": "merge.dev",
              "relevance": 2,
              "official": false
            },
            {
              "title": "Schema | Linear API@current - Apollo Studio",
              "domain": "google.com",
              "relevance": 0,
              "official": false
            }
          ]
        },
        {
          "name": "Exa",
          "verdict": "correct",
          "seconds": 0.63,
          "tokens": 2029,
          "answer": "Based on the official Linear documentation, you can make 2,500 requests per hour when authenticated with an API key.",
          "hits": [
            {
              "title": "Rate limiting",
              "domain": "linear.app",
              "relevance": 3,
              "official": true
            },
            {
              "title": "Getting started",
              "domain": "linear.app",
              "relevance": 1,
              "official": false
            },
            {
              "title": "Linear API Rate Limits and Headers | Throttle",
              "domain": "throttle.com",
              "relevance": 3,
              "official": false
            },
            {
              "title": "fix(linear): honor rate limit reset headers",
              "domain": "github.com",
              "relevance": 2,
              "official": false
            }
          ]
        }
      ]
    },
    {
      "label": "Node.js flag",
      "question": "Which Node.js version added the --process-timeout=N CLI flag?",
      "gold": "Node.js v26.11.0",
      "source": "github.com",
      "providers": [
        {
          "name": "Brave",
          "verdict": "correct",
          "seconds": 1.26,
          "tokens": 3905,
          "answer": "The --process-timeout=N CLI flag was added in Node.js v26.11.0. ^3 The feature was implemented by James M.",
          "hits": [
            {
              "title": "src: add --process-timeout=N by jasnell · Pull Request #66138 · nodejs/node · GitHub",
              "domain": "github.com",
              "relevance": 1,
              "official": false
            },
            {
              "title": "Command-line API | Node.js v26.13.0 Documentation",
              "domain": "nodejs.org",
              "relevance": 1,
              "official": false
            },
            {
              "title": "Node.js 26.11.0 Ships With Native Process Timeout, Faster Text Tools, and SQLite Rename",
              "domain": "linuxcompatible.org",
              "relevance": 3,
              "official": false
            },
            {
              "title": "Command-line API | Node.js v26.12.1 Documentation",
              "domain": "nodejs.org",
              "relevance": 1,
              "official": false
            }
          ]
        },
        {
          "name": "Google",
          "verdict": "correct",
          "seconds": 4.54,
          "tokens": 19414,
          "answer": "The --process-timeout=N CLI flag was added in Node.js version 26.11.0. This release introduced a native process timeout watchdog that automatically stops hung programs…",
          "hits": [
            {
              "title": "Command-line API | Node.js v26.13.0 Documentation",
              "domain": "nodejs.org",
              "relevance": 1,
              "official": false
            },
            {
              "title": "Node.JS: setTimeout that does not keep the process running",
              "domain": "stackoverflow.com",
              "relevance": 0,
              "official": false
            },
            {
              "title": "Node.js Version Support: EOL Dates and Latest Releases ...",
              "domain": "herodevs.com",
              "relevance": 0,
              "official": false
            },
            {
              "title": "Node.js 26.11.0 Ships With Native Process Timeout, Faster ...",
              "domain": "google.com",
              "relevance": 3,
              "official": false
            }
          ]
        },
        {
          "name": "Exa",
          "verdict": "wrong",
          "seconds": 0.74,
          "tokens": 1944,
          "answer": "Based on the sources provided, the --process-timeout CLI flag was added in Node.js v26.0.0.",
          "hits": [
            {
              "title": "Node.js 26.11.0 adds a built-in watchdog for hung processes · Azeem Hassni",
              "domain": "azeemhassni.com",
              "relevance": 3,
              "official": false
            },
            {
              "title": "Command-line API | Node.js v26.7.0 Documentation",
              "domain": "nodejs.org",
              "relevance": 2,
              "official": false
            },
            {
              "title": "node: doc/api/cli.md - v25.9.0 vs. v26.0.0 changes | Fossies Diffs",
              "domain": "fossies.org",
              "relevance": 1,
              "official": false
            },
            {
              "title": "Command-line API | Node.js v21.7.3 Documentation",
              "domain": "nodejs.org",
              "relevance": 0,
              "official": false
            }
          ]
        }
      ]
    }
  ];
  const VERDICTS = { correct: 'Correct', wrong: 'Wrong', none: 'No answer' };
  const [index, setIndex] = useState(0);
  const question = QUESTIONS[index];

  return (
    <div className="vg vg-sc">
      <div className="vg-sc-tabs" role="tablist" aria-label="Benchmark question">
        {QUESTIONS.map((item, i) => (
          <button key={item.label} type="button" role="tab" aria-selected={i === index} className={i === index ? 'is-active' : undefined} onClick={() => setIndex(i)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="vg-sc-ask">
        <p className="vg-sc-question">{question.question}</p>
        <p className="vg-sc-gold">Correct answer: <b>{question.gold}</b>, from {question.source}</p>
      </div>
      <div className="vg-sc-cols">
        {question.providers.map(provider => (
          <div key={provider.name} className={`vg-sc-col is-${provider.verdict}`}>
            <div className="vg-sc-head">
              <b>{provider.name}</b>
              <span className="vg-sc-verdict">{VERDICTS[provider.verdict]}</span>
            </div>
            <div className="vg-sc-stats">{provider.seconds.toFixed(2)} s · {provider.tokens.toLocaleString('en-US')} tokens</div>
            <p className="vg-sc-answer">{provider.answer}</p>
            <ol className="vg-sc-hits">
              {provider.hits.map((hit, i) => (
                <li key={i}>
                  <span className="vg-sc-rel" role="img" aria-label={hit.relevance == null ? 'Not rated' : `Relevance ${hit.relevance} of 3`}>
                    {[0, 1, 2].map(dot => <i key={dot} className={hit.relevance != null && dot < hit.relevance ? 'is-on' : undefined} />)}
                  </span>
                  <span className="vg-sc-hit">
                    <span className="vg-sc-title">{hit.title}</span>
                    <span className="vg-sc-domain">{hit.domain}{hit.official ? <em> · official source</em> : null}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      <p className="vg-sc-foot">Seconds to search, and the tokens the results added to the answer's prompt. Dots rate each result's relevance to the question, from none to three.</p>
    </div>
  );
};
