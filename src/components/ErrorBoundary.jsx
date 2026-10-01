import React from 'react';
export default class ErrorBoundary extends React.Component {
  constructor(props){super(props);this.state={error:null};}
  static getDerivedStateFromError(error){return {error};}
  componentDidCatch(error,info){console.error('[portal] render error',error,info);}
  render(){if(!this.state.error)return this.props.children;return <div className="centered-page"><div className="card card--narrow"><h1 className="card__title">This page needs to reload</h1><p className="text-muted">The portal caught an unexpected display error. Your saved data was not changed.</p><button className="btn btn--primary btn--block" onClick={()=>window.location.reload()}>Reload portal</button></div></div>;}
}
