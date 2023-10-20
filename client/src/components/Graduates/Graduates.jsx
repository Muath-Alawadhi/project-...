// For installing the last version of react-router-dom
// npm install react-router-dom@latest
// npm install axios

import React, { useState , useEffect } from 'react';
import "./Graduates.css";
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
import SearchBar from "./SearchBar";
import { Link } from "react-router-dom";
import GraduatesProfile from '../GraduatesProfile/GraduatesProfile';
import axios from 'axios';



function GradCard({ grad, onViewMore }) {
  return (
    <div>
       <div>
       <Card style={{ width: '17rem' }} key={grad.id}>
             <Card.Img variant="top" src={grad.profile_pic_link} alt={grad.name} className="cards-img" />
             <Card.Body>
              <Card.Title>{grad.name}</Card.Title>
            </Card.Body>
            <ListGroup className="list-group-flush">
              <ListGroup.Item>Username: {grad.github_username}</ListGroup.Item>
              <ListGroup.Item>Repo: {grad.repos_number}</ListGroup.Item>
              <ListGroup.Item>Skills: {grad.skills} </ListGroup.Item>
            </ListGroup>
            <Card.Body>
              <Link onClick={() => onViewMore(grad)}>View More</Link>
            </Card.Body>
          </Card>
    </div>
    </div>
  );
}


function Graduates() {

  const [graduates, setGraduates] = useState([]);
  const [filteredGraduates, setFilteredGraduates] = useState(null);
  const [selectedGrad, setSelectedGrad] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Add a loading state
  const [contributions, setContributions]= useState([]);

  useEffect(()=> {

    const fetchData = async () => {
    try{
      const response = await axios.get('http://localhost:8000/github-contributions');
      console.log("contribution response: ", response.data);
      setContributions(response.data); 
    }
    catch (error) {
      console.error(`error fetching contributions from server: ` + error)
    }
  };
    fetchData();
},[]);

  const handleSearchResults = (filteredData) => {
    setFilteredGraduates(filteredData);
  };




  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/fetchGradData` );
         const responseData = await response.json();
        const data = responseData.graduates; // Access the 'graduates' key as the response from api is--> res.json({ graduates: grads });
        // console.log("Data from API:", data);
        setGraduates(data);
        setIsLoading(false); 
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  },[]);

useEffect(() => {
  // console.log(graduates);
}, [graduates]);


  const handleViewMore = (grad) => {
    setSelectedGrad(grad);
  };

  const handleGoBack = () => {
    setSelectedGrad(null);
  };

const renderContributions = () => {
  
    const calendar = [];
    // Assuming contributions contain data with a "created_at" field
    contributions.forEach(contribution => {
      const date = new Date(contribution.created_at).toLocaleDateString();
      if (!calendar[date]) {
        calendar[date] = 0;
      }
      calendar[date]++;
    });
console.log(contributions[0].created_at);

    const today = new Date().toLocaleDateString();

    return Object.keys(calendar).map((date, index) => (
      <div key={index} className={date === today ? "cell today" : "cell"}>
        <div className="dot" style={{ height: `${calendar[date] * 20}px` }}></div>
      </div>
    ));
  };

    // return contributions.map((contribution, index) => (
    //   <div key={index}>
    //     <p>Date: {contribution.created_at}</p>
    //     <p>Type: {contribution.type}</p>
    //     {/* Render other contribution details as needed */}
    //     <hr /> {/* Add a separator between contributions */}

    //   </div>
    // ));
  // };

  return (
    <div>
      {selectedGrad ? (
        <GraduatesProfile grad={selectedGrad} onGoBack={handleGoBack} onRenderCo={renderContributions}/>
      ) : (
        <div className="grad-cards">
           <SearchBar onSearchResults={handleSearchResults}  />
           <div className="CardsContainerBlock">
            {isLoading ? ( // Check loading state
              <p>Loading data...</p>
            ) : (
              (filteredGraduates || graduates).map((grad) => (
                <GradCard key={grad.id} grad={grad} onViewMore={handleViewMore} />
              ))
            )}
           
          </div>

                  
        </div>
      )}

      

    </div>
  );
}

export default Graduates;

