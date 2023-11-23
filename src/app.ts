import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import axios from 'axios';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());

app.listen(PORT, () => {
  console.log(`Timecard Computing Server is running on port ${PORT}`);
});
app.use(
  cors({
    origin: "*", // that will for all like  https / http
  }),
);

app.post("/timecard", async (req, res) => {
  const { body, params } = req;
 console.log("/timecard", {body: req.body, params: req.params})
  const { cleanerId, period: {startDate, endDate} } = req.body;
  console.log({ cleanerId, startDate, endDate })
  const data = await axios.post('http://localhost:3000/extract-cleaner-data-timecard', {
    cleanerId: cleanerId,
    period: {
      startDate,
      endDate,
    },
  });
  console.log({data: data.data})
  return res.status(200).json({...data.data});

});
