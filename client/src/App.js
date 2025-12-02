// src/App.js

import React from 'react';
import Voting from './components/Voting'; // Import your Voting component

function App() {
    return (
        <div className="App">
            <h1>Secure Voting DApp</h1>
            <Voting />  {/* Render the Voting component */}
        </div>
    );
}

export default App;