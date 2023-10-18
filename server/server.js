//To Do:
//we still need skills from repos path
//sometimes when trying to test code , we are having issues with DB connection
//so, we just need comment out all DB code in order to test other parts, then uncomment them
//or we can wait for some time till the DB connection is back to normal
//

const axios = require("axios"); //library to fetch from Github api
const express = require("express");
const app = express();
const pool = require("./DBConfig");
const cors = require("cors"); //Middleware: to handle CORS-related headers and behavior.
const bodyParser = require("body-parser"); //Middleware: To handle incoming HTTP requests
require("dotenv").config();

const port = parseInt(process.env.PORT ?? "8000", 10);
app.use(bodyParser.json());
app.use(cors());

//-------------GitHup OAuth----------------------
const clientId = process.env.GITHUB_CLIENT_ID;
const clientSecret = process.env.GITHUB_CLIENT_SECRET;
//-----------------------------------------------
let githubAccessToken = null; // Variable to store the access token

//---------------- get the access_token --------------------
app.post("/access-code", async (req, res) => {
  const { code } = req.body;
  console.log(code);
  const response = await axios.post(
    "https://github.com/login/oauth/access_token",
    null,
    {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        code,
      },
      headers: {
        Accept: "application/json",
      },
    }
  );

  const { access_token } = response.data;
  githubAccessToken = access_token;
  console.log(githubAccessToken); // printing the access token for checking

  // After getting the token, immediately fetch and insert data into the database
  await fetchAndInsertData();
  res.json({ success: true });
});

//------------------ get / ---------------------
app.get("/", (req, res) => {
  console.log("welcome to my server");
});

//----------------- fetch Grad data ------------------
async function fetchAndInsertData(res) {
  const client = await pool.connect();
  try {
    //--(1)--giving username fetch --> name , repos number , profile_pic_url ---
    const userDataResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `token ${githubAccessToken}`,
      },
    });
    console.log(userDataResponse);

    const userData = userDataResponse.data;
    const githubUserName = userData.login || "Not available";
    const name = userData.name || "Name Not available";
    const reposNumber = userData.public_repos || 0;
    const profilePicLink = userData.avatar_url || "Not available";
    const github_url = userData.html_url || "Not available";
    const followers = userData.followers || 0;
    const following = userData.following || 0;

    // ---------------------repo.languages--------------------------
    const reposResponse = await axios.get(userData.repos_url, {
      // Using the repos_url to fetch repositories first ^ ^
      headers: {
        Authorization: `token ${githubAccessToken}`,
      },
    });
    // Extract language data from repositories...o-o
    const repos = reposResponse.data;
    console.log(repos);

    const uniqueLanguages = new Set();

    // Iterate through user's repositories to extract languages
    for (const repo of repos) {
      const language = repo.language;
      if (language && language !== "null") {
        uniqueLanguages.add(language);
      }
    }

    const allLanguages = [...uniqueLanguages];
    //-------------------end of repo.languages ----------------------

    //  ------------------- fetch readme file  ----------------------
    let cvLink = "CV link not found";
    let linkedin = "LinkedIn link not found";
    let readmeContent = "Readme content not found";

    try {
      const readmeDataResponse = await axios.get(
        `https://api.github.com/repos/${githubUserName}/${githubUserName}/readme`,
        {
          headers: {
            Authorization: `token ${githubAccessToken}`,
          },
        }
      );

      if (readmeDataResponse.status === 200) {
        // The README content will be in base64-encoded, so we need to decode it
        readmeContent = Buffer.from(
          readmeDataResponse.data.content,
          "base64"
        ).toString("utf-8");

        // cvRegex & linkedinRegex to match CV and LinkedIn links
        const cvRegex =
          /(?<=(?:cv|resume|portfolio)\s*:\s*?)(https?:\/\/(?:www\.)?(?:[a-zA-Z0-9-]+\.)+(?:[a-zA-Z]{2,})(?:\/[^\s]*)?)/i;
        const linkedinRegex = /(https?:\/\/www\.linkedin\.com\/\S+)/i;

        // Search for CV and LinkedIn links in the README content
        const cvMatch = readmeContent.match(cvRegex);
        const linkedinMatch = readmeContent.match(linkedinRegex);

        cvLink = cvMatch ? cvMatch[0] : "CV link not found";
        linkedin = linkedinMatch ? linkedinMatch[0] : "LinkedIn link not found";

        // Remove CV and LinkedIn links from the readme content
        readmeContent = readmeContent
          .replace(cvRegex, "")
          .replace(linkedinRegex, "")
          .replace(
            /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi,
            ""
          ) // Remove any remaining URLs
          .replace(/[[\]{}()]/g, ""); // Remove square brackets, curly braces, and parentheses
      }
    } catch (error) {
      console.error(error);
    }

    //------------------- end of readme file  ---------------------

    // -----------------Start of Database---------------------------

    // Insert data into the Graduates_user table with conflict handling
    const userInsertQuery = {
      text: "INSERT INTO graduates_user (github_username, name, repos_number, profile_pic_link, github_url, followers, following) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (github_username) DO NOTHING",
      values: [
        githubUserName,
        name,
        reposNumber,
        profilePicLink,
        github_url,
        followers,
        following,
      ],
    };
    await client.query(userInsertQuery);

    // Insert data into the skill table ( array of languages)
    const languageInsertQuery = {
      text: "INSERT INTO skills (user_id, languages) VALUES ((SELECT id FROM graduates_user WHERE github_username = $1), $2) ON CONFLICT (user_id) DO NOTHING",
      values: [githubUserName, allLanguages],
    };
    await client.query(languageInsertQuery);

    // Insert data into the Readme table
    const readmeInsertQuery = {
      text: "INSERT INTO readme (user_id, cv_link, linkedin, readme_content) VALUES ((SELECT id FROM graduates_user WHERE github_username = $1), $2, $3, $4) ON CONFLICT (user_id) DO NOTHING",
      values: [githubUserName, cvLink, linkedin, readmeContent],
    };
    await client.query(readmeInsertQuery);

    // -----------------end of Database----------------------------
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
}

//--------- trigger data insertion (Put the data into the database after signing up)---------

app.get("/fetchGradData", async (req, res) => {
  await fetchAndInsertData(); //  this function to trigger data insertion

  // Respond with success message
  res.json({ success: true });
});

//-------------------------------------------------------------------------------------------

//------------------ Endpoint for FrontEnd --------------------------------------------------------
/* having all the related data made into single object for each graduate makes 
it easier to display the info on the front-end. it will make  an array of graduate object from the API, and each object ( uses the id )will contain 
all the information you need to display: this is what it will look like 
{
  id: 1,
  github_username: "nfarah22",
  name: "Name Not Available",
  profile_pic_link: "https://avatars.githubusercontent.com/u/61600465?v=4",
  skills: ["JavaScript", "HTML"],
  readme: {
    user_id: 1,
    cv_link: "CV link not found",
    linkedin: "LinkedIn link not found",
    readme_content: "# nfarah2"
  }
}
*/
app.get("/api/fetchGradData", async (req, res) => {
  try {
    const client = await pool.connect();

    // fetch data from graduates_user
    const graduateQuery =
      "SELECT id, github_username, name, profile_pic_link,repos_number,github_url,followers,following  FROM graduates_user;";
    const graduateData = await client.query(graduateQuery);
    const grads = graduateData.rows;

    // fetch data from readme
    const readmeQuery =
      "SELECT user_id, cv_link, linkedin, readme_content FROM readme;";
    const readmeData = await client.query(readmeQuery);
    const readmes = readmeData.rows;

    // fetch data from skills
    const skillsQuery = "SELECT user_id, languages FROM skills;";
    const skillsData = await client.query(skillsQuery);
    const skills = skillsData.rows;

    // merge all the data using user_id
    for (const grad of grads) {
      // add readme info
      const matchingReadme = readmes.find(
        (readme) => readme.user_id === grad.id
      );
      if (matchingReadme) {
        grad.readme = matchingReadme;
      }

      // add skills info
      const matchingSkills = skills.filter(
        (skill) => skill.user_id === grad.id
      );
      grad.skills = matchingSkills.map((skill) => skill.languages).flat();
    }

    client.release();

    res.json({ graduates: grads });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal connection to DB error" });
  }
});

//---------------- end of Endpoint for FrontEnd  ------------------------------------------------
//----------------------------Search functionality api -------------------------------------------

app.get("/search", async (req, res) => {
  const { name, skills } = req.query;

  try {
    const search = `
      SELECT graduates_user.id, graduates_user.name, skills.languages 
      FROM graduates_user
      JOIN skills ON graduates_user.id = skills.user_id
      WHERE graduates_user.name LIKE $1 OR $2 = ANY(skills.languages);
    `;

    const values = [`%${name}%`, skills];

    const result = await pool.query(search, values);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

app.delete("/api/deleteGradData/:id", async (req, res) => {
  const userId = req.params.id;
  const client = await pool.connect();

  try {
    const deleteReadmeQuery = {
      text: "DELETE FROM readme WHERE user_id = $1",
      values: [userId],
    };
    await client.query(deleteReadmeQuery);

    const deleteSkillsQuery = {
      text: "DELETE FROM skills WHERE user_id = $1",
      values: [userId],
    };
    await client.query(deleteSkillsQuery);

    const deleteUserQuery = {
      text: "DELETE FROM graduates_user WHERE id = $1",
      values: [userId],
    };
    await client.query(deleteUserQuery);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  } finally {
    client.release();
  }
});
//---------------- listen --------------------
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
