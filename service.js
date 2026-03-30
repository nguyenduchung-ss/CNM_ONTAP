const { v4: uuidv4 } = require("uuid");
const { dynamoDbClient, s3Client } = require("../config/aws-config");

const {
    ScanCommand,
    GetCommand,
    PutCommand,
    DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");

const {
    PutObjectCommand,
    DeleteObjectCommand,
} = require("@aws-sdk/client-s3");

const TABLE_NAME = "EventTickets";
const BUCKET_NAME = "bookstore-bucket-s3";
const AWS_REGION = "ap-southeast-1";

const PRIMARY_KEY = "ticketId";
const IMAGE_FIELD = "posterUrl";

const buildImageUrl = (key) =>
    `https://${BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;

const getS3KeyFromUrl = (url) => url?.split("/").pop();

const normalizeData = (body, existing = {}) => {
    const data = { ...existing, ...body };
    if (data.availableQty !== undefined)
        data.availableQty = Number(data.availableQty);
    if (data.price !== undefined) data.price = Number(data.price);
    return data;
};

const validateData = (data) => {
    const errors = [];

    if (!data.eventName?.trim()) errors.push("Tên sự kiện không được trống");
    if (!data.location?.trim()) errors.push("Địa điểm không được trống");

    const validTypes = ["Standard", "VIP", "Student"];
    if (!validTypes.includes(data.ticketType))
        errors.push("ticketType không hợp lệ");

    if (isNaN(data.price) || data.price <= 0)
        errors.push("Giá phải > 0");

    if (isNaN(data.availableQty) || data.availableQty < 0)
        errors.push("Số lượng phải >= 0");

    if (!data.eventDate) {
        errors.push("Ngày không được trống");
    } else {
        const today = new Date();
        today.setHours(0,0,0,0);

        const d = new Date(data.eventDate);
        d.setHours(0,0,0,0);

        if (isNaN(d.getTime()) || d < today)
            errors.push("Ngày phải >= hôm nay");

        data.eventDate = d.toISOString();
    }

    if (errors.length) throw new Error(errors.join(", "));
};

const uploadFile = async (file) => {
    if (!file) return null;

    const key = Date.now() + "-" + file.originalname;

    await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
    }));

    return buildImageUrl(key);
};

const deleteFile = async (url) => {
    const key = getS3KeyFromUrl(url);
    if (!key) return;

    await s3Client.send(new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
    }));
};

// CRUD

const getAllItems = async (keyword = "", type = "") => {
    const result = await dynamoDbClient.send(new ScanCommand({
        TableName: TABLE_NAME,
    }));

    const items = result.Items || [];
    const k = keyword.toLowerCase();

    return items.filter(item => {
        const name = (item.eventName || "").toLowerCase();
        const loc = (item.location || "").toLowerCase();

        const matchKeyword = name.includes(k) || loc.includes(k);
        const matchType = !type || item.ticketType === type;

        return matchKeyword && matchType;
    });
};

const getItemById = async (id) => {
    const res = await dynamoDbClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: { [PRIMARY_KEY]: id },
    }));
    return res.Item;
};

const saveItem = async (id, body, file) => {
    let existing = null;

    if (id) {
        existing = await getItemById(id);
        if (!existing) throw new Error("Không tìm thấy");
    }

    let item = normalizeData(body, existing || {});
    item[PRIMARY_KEY] = id || body.ticketId || uuidv4();

    validateData(item);

    if (file) {
        const url = await uploadFile(file);

        if (existing?.posterUrl) {
            await deleteFile(existing.posterUrl);
        }

        item.posterUrl = url;
    } else if (existing?.posterUrl) {
        item.posterUrl = existing.posterUrl;
    }

    await dynamoDbClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
    }));

    return item;
};

const deleteItemById = async (id) => {
    const existing = await getItemById(id);

    if (existing?.posterUrl) {
        await deleteFile(existing.posterUrl);
    }

    await dynamoDbClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { [PRIMARY_KEY]: id },
    }));
};

module.exports = {
    getAllItems,
    getItemById,
    saveItem,
    deleteItemById,
};