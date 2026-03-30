const {
    getAllItems,
    getItemById,
    saveItem,
    deleteItemById,
} = require("../service/ticket-service");

const renderIndex = async (req, res) => {
    const { keyword = "", type = "" } = req.query;

    const items = await getAllItems(keyword, type);

    const data = items.map(item => {
        const price = Number(item.price || 0);
        const qty = Number(item.availableQty || 0);

        let status = "Open";
        if (qty === 0) status = "Sold Out";
        else if (qty < 10) status = "Limited";

        return {
            ...item,
            revenue: price * qty,
            status
        };
    });

    const totalRevenue = data.reduce((s, i) => s + i.revenue, 0);

    res.render("index", { items: data, keyword, type, totalRevenue });
};

const renderForm = async (req, res) => {
    const { ticketId } = req.params;
    let item = null;

    if (ticketId) {
        item = await getItemById(ticketId);
    }

    res.render("form", { item, error: null });
};

const handleSave = async (req, res) => {
    const { ticketId } = req.params;

    try {
        await saveItem(ticketId, req.body, req.file);
        res.redirect("/tickets");
    } catch (e) {
        res.render("form", { item: req.body, error: e.message });
    }
};

const handleDelete = async (req, res) => {
    await deleteItemById(req.params.ticketId);
    res.redirect("/tickets");
};

module.exports = {
    renderIndex,
    renderForm,
    handleSave,
    handleDelete,
};