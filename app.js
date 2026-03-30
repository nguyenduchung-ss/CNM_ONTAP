const express = require("express");
const multer = require("multer");
const {
    renderIndex,
    renderForm,
    handleSave,
    handleDelete,
} = require("./controllers/book-controller"); //sua ten file controller cho dung
const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
const upload = multer({ storage: multer.memoryStorage() });

// View
app.set("view engine", "ejs");
app.set("views", "./views");

// View Route
app.get("/books", renderIndex);
app.get("/add", renderForm);
app.get("/edit/:bookId", renderForm); //sua ten Id cho dung

// Api Route
app.post("/add", upload.single("image"), handleSave);
app.post(
    "/edit/:bookId", //sua ten Id cho dung
    upload.single("image"),
    handleSave,
);
app.post("/delete/:bookId", handleDelete); //sua ten Id cho dung

// Listen
app.listen(3000, () => {
    console.log("Server on");
});
