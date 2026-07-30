import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLanguage } from '../../../context/LanguageContext';
import '../../../styles/Support.css';

export default function Support() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const { t } = useLanguage();
  
  const [activeTab, setActiveTab] = useState(tabParam || 'faq');
  const [activeFaqIndex, setActiveFaqIndex] = useState(null);

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    setSearchParams({ tab: tabName });
  };

  const toggleFaq = (index) => {
    if (activeFaqIndex === index) {
      setActiveFaqIndex(null);
    } else {
      setActiveFaqIndex(index);
    }
  };

  const faqItems = useMemo(() => [
    {
      question: t('support.faq_q1'),
      answer: t('support.faq_a1')
    },
    {
      question: t('support.faq_q2'),
      answer: t('support.faq_a2')
    },
    {
      question: t('support.faq_q3'),
      answer: t('support.faq_a3')
    },
    {
      question: t('support.faq_q4'),
      answer: t('support.faq_a4')
    },
    {
      question: t('support.faq_q5'),
      answer: t('support.faq_a5')
    }
  ], [t]);

  return (
    <div className="support-container container">
      <div className="support-header">
        <h1>{t('support.title')}</h1>
        <p>{t('support.subtitle')}</p>
      </div>

      <div className="support-nav">
        <button 
          className={`support-nav-btn ${activeTab === 'faq' ? 'active' : ''}`}
          onClick={() => handleTabChange('faq')}
        >
          {t('support.tab_faq')}
        </button>
        <button 
          className={`support-nav-btn ${activeTab === 'safety' ? 'active' : ''}`}
          onClick={() => handleTabChange('safety')}
        >
          {t('support.tab_safety')}
        </button>
        <button 
          className={`support-nav-btn ${activeTab === 'terms' ? 'active' : ''}`}
          onClick={() => handleTabChange('terms')}
        >
          {t('support.tab_terms')}
        </button>
        <button 
          className={`support-nav-btn ${activeTab === 'privacy' ? 'active' : ''}`}
          onClick={() => handleTabChange('privacy')}
        >
          {t('support.tab_privacy')}
        </button>
      </div>

      <div className="support-content-box glass-panel">
        {activeTab === 'faq' && (
          <div>
            <h2>{t('support.faq_heading')}</h2>
            <div className="support-accordion">
              {faqItems.map((item, idx) => (
                <div 
                  key={idx} 
                  className={`support-accordion-item ${activeFaqIndex === idx ? 'active' : ''}`}
                >
                  <button 
                    className="support-accordion-header"
                    onClick={() => toggleFaq(idx)}
                  >
                    {item.question}
                    <svg className="support-accordion-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                  <div className="support-accordion-content">
                    <p>{item.answer}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="support-contact-cta">
              <h3>{t('support.still_questions')}</h3>
              <p>{t('support.ai_notice')}</p>
              <a href="mailto:support@retrade.com" className="btn btn-primary">{t('support.contact_btn')}</a>
            </div>
          </div>
        )}

        {activeTab === 'safety' && (
          <div>
            <h2>{t('support.safety_heading')}</h2>
            <p>{t('support.safety_intro')}</p>
            
            <h3>{t('support.safety_s1_title')}</h3>
            <ul>
              <li>{t('support.safety_s1_li1')}</li>
              <li>{t('support.safety_s1_li2')}</li>
              <li>{t('support.safety_s1_li3')}</li>
            </ul>

            <h3>{t('support.safety_s2_title')}</h3>
            <ul>
              <li>{t('support.safety_s2_li1')}</li>
              <li>{t('support.safety_s2_li2')}</li>
              <li>{t('support.safety_s2_li3')}</li>
            </ul>

            <h3>{t('support.safety_s3_title')}</h3>
            <ul>
              <li>{t('support.safety_s3_li1')}</li>
              <li>{t('support.safety_s3_li2')}</li>
            </ul>

            <h3>{t('support.safety_s4_title')}</h3>
            <ul>
              <li>{t('support.safety_s4_li1')}</li>
              <li>{t('support.safety_s4_li2')}</li>
              <li>{t('support.safety_s4_li3')}</li>
            </ul>

            <h3>{t('support.safety_s5_title')}</h3>
            <ul>
              <li>{t('support.safety_s5_li1')}</li>
              <li>{t('support.safety_s5_li2')}</li>
              <li>{t('support.safety_s5_li3')}</li>
            </ul>

            <div className="support-contact-cta">
              <h3>{t('support.suspicious_title')}</h3>
              <p>{t('support.suspicious_desc')}</p>
              <a href="#" className="btn btn-primary">{t('support.report_issue_btn')}</a>
            </div>
          </div>
        )}

        {activeTab === 'terms' && (
          <div>
            <h2>{t('support.terms_heading')}</h2>
            <p>{t('support.terms_updated')}</p>
            
            <h3>{t('support.terms_sec1_title')}</h3>
            <p>{t('support.terms_sec1_desc')}</p>

            <h3>{t('support.terms_sec2_title')}</h3>
            <p>{t('support.terms_sec2_desc')}</p>

            <h3>{t('support.terms_sec3_title')}</h3>
            <ul>
              <li>{t('support.terms_sec3_li1')}</li>
              <li>{t('support.terms_sec3_li2')}</li>
              <li>{t('support.terms_sec3_li3')}</li>
            </ul>

            <h3>{t('support.terms_sec4_title')}</h3>
            <ul>
              <li>{t('support.terms_sec4_li1')}</li>
              <li>{t('support.terms_sec4_li2')}</li>
              <li>{t('support.terms_sec4_li3')}</li>
            </ul>

            <h3>{t('support.terms_sec5_title')}</h3>
            <p>{t('support.terms_sec5_desc')}</p>

            <h3>{t('support.terms_sec6_title')}</h3>
            <p>{t('support.terms_sec6_desc')}</p>

            <h3>{t('support.terms_sec7_title')}</h3>
            <p>{t('support.terms_sec7_desc')}</p>
          </div>
        )}

        {activeTab === 'privacy' && (
          <div>
            <h2>{t('support.privacy_heading')}</h2>
            <p>{t('support.privacy_intro')}</p>

            <h3>{t('support.privacy_sec1_title')}</h3>
            <ul>
              <li>{t('support.privacy_sec1_li1')}</li>
              <li>{t('support.privacy_sec1_li2')}</li>
              <li>{t('support.privacy_sec1_li3')}</li>
            </ul>

            <h3>{t('support.privacy_sec2_title')}</h3>
            <p>{t('support.privacy_sec2_desc')}</p>
            <ul>
              <li>{t('support.privacy_sec2_li1')}</li>
              <li>{t('support.privacy_sec2_li2')}</li>
              <li>{t('support.privacy_sec2_li3')}</li>
              <li>{t('support.privacy_sec2_li4')}</li>
            </ul>

            <h3>{t('support.privacy_sec3_title')}</h3>
            <ul>
              <li>{t('support.privacy_sec3_li1')}</li>
              <li>{t('support.privacy_sec3_li2')}</li>
              <li>{t('support.privacy_sec3_li3')}</li>
            </ul>

            <h3>{t('support.privacy_sec4_title')}</h3>
            <p>{t('support.privacy_sec4_desc')}</p>

            <h3>{t('support.privacy_sec5_title')}</h3>
            <p>{t('support.privacy_sec5_desc')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
