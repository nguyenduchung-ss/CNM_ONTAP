const express = require("express");
const multer = require("multer");
const {
    renderIndex,
    renderForm,
    handleSave,
    handleDelete,
} = require("./controllers/ticket-controller");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const upload = multer({ storage: multer.memoryStorage() });

app.set("view engine", "ejs");

app.get("/tickets", renderIndex);
app.get("/add", renderForm);
app.get("/edit/:ticketId", renderForm);

app.post("/add", upload.single("image"), handleSave);
app.post("/edit/:ticketId", upload.single("image"), handleSave);
app.post("/delete/:ticketId", handleDelete);

app.listen(3000, () => console.log("Server running"));