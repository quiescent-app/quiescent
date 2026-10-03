function App() {
  const handleOpenQuiescent = () => {
    window.open("http://localhost:3000", "_blank");
  };

  return (
    <>
      <h1>Readify</h1>
      <button onClick={handleOpenQuiescent}>Click to go to Quiescent</button>
    </>
  );
}

export default App;
