const {
    getAllItems,
    getItemById,
    saveItem,
    deleteItemById,
} = require("../service/book-service"); //sua ten file service cho dung

const renderIndex = async(req, res) => {
    try {
        const { keyword = "" } = req.query;
        const items = await getAllItems(keyword);

        const itemsWithInventoryValue = items.map((item) => {
            const unitInStock = Number(item.unit_in_stock) || 0;
            const price = Number(item.price) || 0;

            return {
                ...item,
                inventoryValue: unitInStock * price,
            };
        });

        const totalInventoryValue = itemsWithInventoryValue.reduce(
            (sum, item) => sum + item.inventoryValue,
            0,
        );

        res.render("index", {
            items: itemsWithInventoryValue,
            keyword,
            totalInventoryValue,
        });
    } catch (error) {
        res.status(500).send(error.message);
    }
};

const renderForm = async(req, res) => {
    try {
        const { bookId } = req.params; //sua ten Id cho dung
        let item = null;

        if (bookId) { //sua ten Id cho dung
            item = await getItemById(bookId); //sua ten Id cho dung
            if (!item) {
                return res.status(404).send("Không tìm thấy dữ liệu");
            }
        }

        res.render("form", {
            item,
            error: null,
        });
    } catch (error) {
        res.status(500).send(error.message);
    }
};

const handleSave = async(req, res) => {
    const { bookId } = req.params; //sua ten Id cho dung

    try {
        await saveItem(bookId, req.body, req.file);
        res.redirect("/books");
    } catch (error) {
        res.status(400).render("form", {
            item: {
                bookId: bookId || req.body.bookId, //sua ten Id cho dung
                ...req.body,
            },
            error: error.message,
        });
    }
};

const handleDelete = async(req, res) => {
    try {
        await deleteItemById(req.params.bookId); //sua ten Id cho dung
        res.redirect("/books");
    } catch (error) {
        res.status(500).send(error.message);
    }
};

module.exports = {
    renderIndex,
    renderForm,
    handleSave,
    handleDelete,
};
